import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import { canAccessThesis, type Actor } from "@/lib/permissions";
import { audit } from "../audit";

export const thesisInput = z.object({
  companyId: z.string().min(1),
  title: z.string().trim().min(3).max(160),
  rationale: z.string().trim().min(10).max(5000),
  reassessmentConditions: z.string().trim().max(3000).default(""),
  reviewDate: z.coerce.date().optional().nullable(),
  assumptions: z.array(z.object({ statement: z.string().trim().min(5).max(500), topics: z.array(z.string()).default([]) })).max(20).default([]),
  indicators: z
    .array(
      z.object({
        metricKey: z.string().trim().min(1).max(80),
        label: z.string().trim().min(1).max(120),
        operator: z.enum(["BELOW", "ABOVE"]).default("BELOW"),
        threshold: z.number().finite().optional().nullable(),
        unit: z.string().trim().max(40).default(""),
      }),
    )
    .max(20)
    .default([]),
  versionNote: z.string().trim().max(300).default(""),
});
export type ThesisInput = z.input<typeof thesisInput>;

const include = {
  company: true,
  assumptions: { orderBy: { position: "asc" } },
  indicators: true,
  versions: { orderBy: { version: "desc" } },
  evidence: {
    orderBy: { createdAt: "desc" },
    include: { announcement: { select: { id: true, headline: true, summary: true, provenance: true, sourcePublishedAt: true, status: true, publisher: true, isFictional: true, revision: true } }, assumption: true },
  },
} satisfies Prisma.ThesisInclude;

function snapshot(t: { title: string; rationale: string; reassessmentConditions: string; reviewDate: Date | null }, input: z.output<typeof thesisInput>) {
  return {
    title: t.title,
    rationale: t.rationale,
    reassessmentConditions: t.reassessmentConditions,
    reviewDate: t.reviewDate?.toISOString() ?? null,
    assumptions: input.assumptions,
    indicators: input.indicators,
  };
}

export async function listTheses(actor: Actor) {
  return db.thesis.findMany({
    where: { ownerId: actor.id },
    orderBy: { updatedAt: "desc" },
    include: { company: true, _count: { select: { evidence: { where: { status: "PENDING_REVIEW" } } } } },
  });
}

/** Theses are private: a thesis that belongs to someone else is reported as not found. */
export async function getThesis(actor: Actor, id: string) {
  const t = await db.thesis.findUnique({ where: { id }, include });
  if (!t || !canAccessThesis(actor, t)) throw new NotFoundError("Thesis not found");
  return t;
}

export async function createThesis(actor: Actor, raw: ThesisInput) {
  const input = thesisInput.parse(raw);
  const t = await db.$transaction(async (tx) => {
    const thesis = await tx.thesis.create({
      data: {
        ownerId: actor.id,
        companyId: input.companyId,
        title: input.title,
        rationale: input.rationale,
        reassessmentConditions: input.reassessmentConditions,
        reviewDate: input.reviewDate ?? null,
        version: 1,
        assumptions: { create: input.assumptions.map((a, i) => ({ ...a, position: i })) },
        indicators: { create: input.indicators.map((x) => ({ ...x, threshold: x.threshold ?? null })) },
      },
    });
    await tx.thesisVersion.create({ data: { thesisId: thesis.id, version: 1, snapshot: snapshot(thesis, input), note: input.versionNote || "First version" } });
    return thesis;
  });
  await audit(actor.id, "thesis.create", "Thesis", t.id);
  return t;
}

/**
 * Saves a new version. Assumptions are matched by statement so that evidence linked to an unchanged
 * assumption stays attached; removed assumptions keep their evidence history (assumption link set to null).
 */
export async function updateThesis(actor: Actor, id: string, raw: ThesisInput) {
  const existing = await getThesis(actor, id);
  const input = thesisInput.parse(raw);
  const next = existing.version + 1;
  await db.$transaction(async (tx) => {
    const keep = new Map(existing.assumptions.map((a) => [a.statement, a]));
    const wanted = new Set(input.assumptions.map((a) => a.statement));
    for (const a of existing.assumptions) if (!wanted.has(a.statement)) await tx.assumption.delete({ where: { id: a.id } });
    for (const [i, a] of input.assumptions.entries()) {
      const prev = keep.get(a.statement);
      if (prev) await tx.assumption.update({ where: { id: prev.id }, data: { topics: a.topics, position: i } });
      else await tx.assumption.create({ data: { thesisId: id, statement: a.statement, topics: a.topics, position: i } });
    }
    await tx.thesisIndicator.deleteMany({ where: { thesisId: id } });
    await tx.thesisIndicator.createMany({ data: input.indicators.map((x) => ({ ...x, threshold: x.threshold ?? null, thesisId: id })) });
    const t = await tx.thesis.update({
      where: { id },
      data: { title: input.title, rationale: input.rationale, reassessmentConditions: input.reassessmentConditions, reviewDate: input.reviewDate ?? null, version: next, companyId: input.companyId },
    });
    await tx.thesisVersion.create({ data: { thesisId: id, version: next, snapshot: snapshot(t, input), note: input.versionNote || `Version ${next}` } });
  });
  await audit(actor.id, "thesis.update", "Thesis", id, { version: next });
  return getThesis(actor, id);
}

export async function deleteThesis(actor: Actor, id: string) {
  await getThesis(actor, id);
  await db.thesis.delete({ where: { id } });
  await audit(actor.id, "thesis.delete", "Thesis", id);
}

/** The user decides what a suggestion means for their thesis. Nothing about the thesis text changes. */
export async function reviewSuggestion(actor: Actor, evidenceId: string, decision: "SUPPORTS" | "CHALLENGES" | "UNCLEAR" | "DISMISS", note = "") {
  const ev = await db.thesisEvidence.findUnique({ where: { id: evidenceId }, include: { thesis: true } });
  if (!ev || !canAccessThesis(actor, ev.thesis)) throw new NotFoundError();
  await db.thesisEvidence.update({
    where: { id: evidenceId },
    data: decision === "DISMISS" ? { status: "DISMISSED", note } : { status: "ACCEPTED", stance: decision, note },
  });
  await audit(actor.id, "thesis.review_evidence", "ThesisEvidence", evidenceId, { decision });
}

export async function addUserEvidence(actor: Actor, thesisId: string, input: { assumptionId?: string | null; announcementId?: string | null; stance: string; note: string }) {
  const t = await getThesis(actor, thesisId);
  if (input.assumptionId && !t.assumptions.some((a) => a.id === input.assumptionId)) throw new AppError("Unknown assumption");
  if (!input.note.trim() && !input.announcementId) throw new AppError("Add a note or link an announcement.");
  if (input.announcementId) {
    const a = await db.announcement.findUnique({ where: { id: input.announcementId } });
    if (!a || a.status !== "PUBLISHED") throw new AppError("Only published announcements can be linked.");
  }
  await db.thesisEvidence.create({
    data: { thesisId, assumptionId: input.assumptionId || null, announcementId: input.announcementId || null, stance: input.stance, note: input.note.trim(), origin: "USER", status: "ACCEPTED" },
  }).catch((e) => {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new AppError("That announcement is already linked to this assumption.");
    throw e;
  });
}

/** Compares disclosed metrics against the user's thresholds. Only published, disclosed values count. */
export async function thresholdStatus(actor: Actor, thesisId: string) {
  const t = await getThesis(actor, thesisId);
  const results = [];
  for (const ind of t.indicators) {
    const m = await db.metric.findFirst({
      where: { companyId: t.companyId, key: ind.metricKey, status: "PUBLISHED", disclosureStatus: "DISCLOSED" },
      orderBy: { periodEnd: "desc" },
    });
    const value = m?.value ? Number(m.value) : null;
    const threshold = ind.threshold !== null ? Number(ind.threshold) : null;
    let state: "NO_DATA" | "BREACHED" | "OK" | "NO_THRESHOLD" = "NO_DATA";
    if (value !== null && threshold === null) state = "NO_THRESHOLD";
    else if (value !== null && threshold !== null) state = (ind.operator === "BELOW" ? value < threshold : value > threshold) ? "BREACHED" : "OK";
    results.push({ indicator: ind, metric: m, value, threshold, state });
  }
  return results;
}
