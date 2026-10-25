import type { Prisma, Provenance, DocumentType } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { can, canViewPublication, type Actor } from "@/lib/permissions";
import { audit } from "../audit";
import { notifyWatchers } from "./alerts";
import { suggestEvidenceForTheses } from "./thesis-matching";

const PUBLIC = ["PUBLISHED", "RETRACTED", "SUPERSEDED"] as const;

export const announcementInput = z.object({
  companyId: z.string().min(1),
  legalEntityId: z.string().optional().nullable(),
  sourceId: z.string().optional().nullable(),
  headline: z.string().trim().min(5).max(200),
  originalTitle: z.string().trim().min(3).max(300),
  publisher: z.string().trim().min(2).max(200),
  sourceUrl: z.string().trim().url().max(1000),
  documentType: z.string() as z.ZodType<DocumentType>,
  sourceVersion: z.string().trim().max(40).default("1"),
  eventDate: z.coerce.date().optional().nullable(),
  sourcePublishedAt: z.coerce.date(),
  retrievedAt: z.coerce.date().optional(),
  provenance: z.string() as z.ZodType<Provenance>,
  summary: z.string().trim().min(10).max(2000),
  whatChanged: z.string().trim().max(2000).default(""),
  whyItMatters: z.string().trim().min(10).max(2000),
  uncertainties: z.string().trim().min(5).max(2000),
  analysis: z.string().trim().max(10000).default(""),
  alternativeExplanations: z.string().trim().max(3000).default(""),
  openQuestions: z.string().trim().max(3000).default(""),
  topics: z.array(z.string()).default([]),
  aiGenerated: z.boolean().default(false),
  isFictional: z.boolean().default(false),
  excerpts: z
    .array(z.object({ quote: z.string().trim().min(3).max(1500), documentId: z.string().optional().nullable(), page: z.number().int().positive().optional().nullable() }))
    .default([]),
});
export type AnnouncementInput = z.input<typeof announcementInput>;

export type AnnouncementFilters = { companyId?: string; topic?: string; provenance?: Provenance; q?: string; includeDrafts?: boolean; take?: number };

export async function listAnnouncements(actor: Actor | null, f: AnnouncementFilters = {}) {
  const where: Prisma.AnnouncementWhereInput = {
    ...(f.companyId ? { companyId: f.companyId } : {}),
    ...(f.topic ? { topics: { has: f.topic } } : {}),
    ...(f.provenance ? { provenance: f.provenance } : {}),
    ...(f.q
      ? { OR: [{ headline: { contains: f.q, mode: "insensitive" } }, { summary: { contains: f.q, mode: "insensitive" } }, { publisher: { contains: f.q, mode: "insensitive" } }] }
      : {}),
    status: f.includeDrafts && can.viewEditorial(actor) ? undefined : { in: [...PUBLIC] },
  };
  return db.announcement.findMany({
    where,
    orderBy: [{ sourcePublishedAt: "desc" }],
    take: f.take ?? 50,
    include: { company: true, legalEntity: true, excerpts: true, supersededBy: { select: { id: true, headline: true } } },
  });
}

export async function getAnnouncement(actor: Actor | null, id: string) {
  const a = await db.announcement.findUnique({
    where: { id },
    include: {
      company: true,
      legalEntity: true,
      source: true,
      excerpts: { include: { document: { select: { id: true, title: true, visibility: true, ownerId: true, status: true } } } },
      corrections: { orderBy: { createdAt: "desc" } },
      reviews: { orderBy: { createdAt: "desc" }, include: { reviewer: { select: { name: true, role: true } } } },
      supersedes: { select: { id: true, headline: true, status: true } },
      supersededBy: { select: { id: true, headline: true, status: true } },
      conflictClaims: { include: { conflict: { include: { claims: true } } } },
    },
  });
  if (!a || !canViewPublication(actor, a.status)) throw new NotFoundError("Announcement not found");
  // Excerpts may only point at documents the reader is allowed to open.
  a.excerpts = a.excerpts.map((e) =>
    e.document && e.document.visibility === "PRIVATE" && e.document.ownerId !== actor?.id ? { ...e, document: null, documentId: null } : e,
  );
  return a;
}

export async function createDraft(actor: Actor, raw: AnnouncementInput) {
  if (!can.draftContent(actor)) throw new ForbiddenError();
  const input = announcementInput.parse(raw);
  const { excerpts, ...data } = input;
  const ann = await db.announcement.create({
    data: {
      ...data,
      retrievedAt: data.retrievedAt ?? new Date(),
      status: "DRAFT",
      createdById: actor.id,
      excerpts: { create: excerpts.map((e) => ({ quote: e.quote, documentId: e.documentId ?? null, page: e.page ?? null })) },
    },
  });
  await audit(actor.id, "announcement.create_draft", "Announcement", ann.id, { aiGenerated: ann.aiGenerated });
  return ann;
}

/** Editors can revise drafts freely. Published items must go through correctAnnouncement so the change is logged. */
export async function updateDraft(actor: Actor, id: string, raw: Partial<AnnouncementInput>) {
  if (!can.draftContent(actor)) throw new ForbiddenError();
  const existing = await db.announcement.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError();
  if (!["DRAFT", "IN_REVIEW"].includes(existing.status)) throw new AppError("Published items must be changed with a logged correction.");
  const parsed = announcementInput.partial().parse(raw);
  const { excerpts, ...data } = parsed;
  const updated = await db.$transaction(async (tx) => {
    if (excerpts) {
      await tx.excerpt.deleteMany({ where: { announcementId: id } });
      await tx.excerpt.createMany({ data: excerpts.map((e) => ({ announcementId: id, quote: e.quote, documentId: e.documentId ?? null, page: e.page ?? null })) });
    }
    // Any edit after review invalidates the approval.
    return tx.announcement.update({ where: { id }, data: { ...data, status: "DRAFT", reviewerId: null, reviewedAt: null } });
  });
  await audit(actor.id, "announcement.update_draft", "Announcement", id);
  return updated;
}

export async function submitForReview(actor: Actor, id: string) {
  if (!can.draftContent(actor)) throw new ForbiddenError();
  const a = await db.announcement.findUnique({ where: { id }, include: { excerpts: true } });
  if (!a) throw new NotFoundError();
  if (a.status !== "DRAFT") throw new AppError("Only drafts can be submitted for review.");
  await db.announcement.update({ where: { id }, data: { status: "IN_REVIEW" } });
  await audit(actor.id, "announcement.submit", "Announcement", id);
}

export async function reviewAnnouncement(actor: Actor, id: string, decision: "APPROVE" | "REQUEST_CHANGES" | "REJECT", notes = "") {
  if (!can.publish(actor)) throw new ForbiddenError("Only editors can review announcements.");
  const a = await db.announcement.findUnique({ where: { id } });
  if (!a) throw new NotFoundError();
  if (a.status !== "IN_REVIEW") throw new AppError("This item is not awaiting review.");
  await db.$transaction(async (tx) => {
    await tx.editorialReview.create({ data: { announcementId: id, reviewerId: actor.id, decision, notes } });
    await tx.announcement.update({
      where: { id },
      data: decision === "APPROVE" ? { reviewerId: actor.id, reviewedAt: new Date() } : { status: "DRAFT", reviewerId: null, reviewedAt: null },
    });
    await audit(actor.id, `announcement.review.${decision.toLowerCase()}`, "Announcement", id, { notes }, tx);
  });
}

/** Reasons an item cannot be published yet. Empty means it is ready. */
export async function publicationBlockers(id: string): Promise<string[]> {
  const a = await db.announcement.findUnique({ where: { id }, include: { excerpts: true, source: true } });
  if (!a) return ["Not found"];
  const blockers: string[] = [];
  if (a.status !== "IN_REVIEW") blockers.push("The item must be submitted for review.");
  if (!a.reviewerId || !a.reviewedAt) blockers.push("An editor must approve the item in review.");
  if (!a.sourceUrl) blockers.push("A source URL is required.");
  if (a.excerpts.length === 0) blockers.push("At least one supporting excerpt or page reference is required.");
  if (a.source && !a.source.approved) blockers.push(`The source “${a.source.name}” has not been approved by an editor.`);
  return blockers;
}

export async function publishAnnouncement(actor: Actor, id: string) {
  if (!can.publish(actor)) throw new ForbiddenError("Only editors can publish.");
  const blockers = await publicationBlockers(id);
  if (blockers.length) throw new AppError(`Cannot publish: ${blockers.join(" ")}`);
  return db.$transaction(async (tx) => {
    const a = await tx.announcement.update({ where: { id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    // If this item supersedes an earlier one, close out the earlier version publicly.
    if (a.supersedesId) {
      const old = await tx.announcement.update({ where: { id: a.supersedesId }, data: { status: "SUPERSEDED" } });
      await tx.correction.create({
        data: {
          entityType: "Announcement",
          entityId: old.id,
          announcementId: old.id,
          kind: "SUPERSESSION",
          summary: `Superseded by “${a.headline}”.`,
          after: { supersededBy: a.id },
          createdById: actor.id,
        },
      });
      await notifyWatchers({ ...old, revision: old.revision }, "SUPERSESSION", `A newer version is available: “${a.headline}”.`, tx);
    }
    await notifyWatchers(a, "NEW_ANNOUNCEMENT", a.summary, tx);
    await suggestEvidenceForTheses(a, tx, "published");
    await audit(actor.id, "announcement.publish", "Announcement", id, undefined, tx);
    return a;
  });
}

const CORRECTABLE = ["headline", "summary", "whatChanged", "whyItMatters", "uncertainties", "analysis", "alternativeExplanations", "openQuestions", "eventDate", "sourcePublishedAt", "sourceUrl", "originalTitle", "topics"] as const;

/**
 * Corrects a published announcement in place. The previous values are kept in the public corrections
 * log, the revision number increases, watchers are alerted and affected theses get the item back for review.
 */
export async function correctAnnouncement(actor: Actor, id: string, changes: Partial<Record<(typeof CORRECTABLE)[number], unknown>>, summary: string) {
  if (!can.publish(actor)) throw new ForbiddenError("Only editors can correct published content.");
  if (!summary || summary.trim().length < 10) throw new AppError("Describe the correction in at least 10 characters.");
  const a = await db.announcement.findUnique({ where: { id } });
  if (!a) throw new NotFoundError();
  if (a.status !== "PUBLISHED") throw new AppError("Only published items can be corrected. Edit drafts directly.");
  const parsed = announcementInput.partial().pick(Object.fromEntries(CORRECTABLE.map((k) => [k, true])) as any).parse(changes) as Record<string, unknown>;
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed)) {
    const prev = (a as any)[k];
    const same = prev instanceof Date && v instanceof Date ? prev.getTime() === v.getTime() : JSON.stringify(prev) === JSON.stringify(v);
    if (v !== undefined && !same) {
      before[k] = prev;
      after[k] = v;
    }
  }
  if (Object.keys(after).length === 0) throw new AppError("No fields were changed.");
  return db.$transaction(async (tx) => {
    const updated = await tx.announcement.update({ where: { id }, data: { ...after, revision: { increment: 1 } } });
    await tx.correction.create({
      data: {
        entityType: "Announcement",
        entityId: id,
        announcementId: id,
        kind: "CORRECTION",
        summary: summary.trim(),
        before: JSON.parse(JSON.stringify(before)),
        after: JSON.parse(JSON.stringify(after)),
        createdById: actor.id,
      },
    });
    await notifyWatchers(updated, "CORRECTION", summary.trim(), tx);
    await suggestEvidenceForTheses(updated, tx, "corrected");
    await audit(actor.id, "announcement.correct", "Announcement", id, { fields: Object.keys(after) }, tx);
    return updated;
  });
}

export async function retractAnnouncement(actor: Actor, id: string, reason: string) {
  if (!can.publish(actor)) throw new ForbiddenError();
  if (!reason || reason.trim().length < 10) throw new AppError("Give a reason for the retraction (at least 10 characters).");
  const a = await db.announcement.findUnique({ where: { id } });
  if (!a) throw new NotFoundError();
  if (a.status !== "PUBLISHED") throw new AppError("Only published items can be retracted.");
  return db.$transaction(async (tx) => {
    const updated = await tx.announcement.update({ where: { id }, data: { status: "RETRACTED", retractedAt: new Date(), retractionReason: reason.trim(), revision: { increment: 1 } } });
    await tx.correction.create({ data: { entityType: "Announcement", entityId: id, announcementId: id, kind: "RETRACTION", summary: reason.trim(), createdById: actor.id } });
    await notifyWatchers(updated, "RETRACTION", reason.trim(), tx);
    // Retracted items must not keep supporting anyone's thesis silently.
    const evidence = await tx.thesisEvidence.findMany({ where: { announcementId: id }, include: { thesis: true } });
    for (const ev of evidence) {
      await tx.thesisEvidence.update({ where: { id: ev.id }, data: { status: "PENDING_REVIEW", matchReason: `This item was retracted: ${reason.trim()}` } });
    }
    await audit(actor.id, "announcement.retract", "Announcement", id, { reason }, tx);
    return updated;
  });
}

/** Creates a new draft that will replace a published item once it is reviewed and published. */
export async function createSupersedingDraft(actor: Actor, oldId: string, raw: AnnouncementInput) {
  if (!can.publish(actor)) throw new ForbiddenError();
  const old = await db.announcement.findUnique({ where: { id: oldId }, include: { supersededBy: true } });
  if (!old) throw new NotFoundError();
  if (old.status !== "PUBLISHED") throw new AppError("Only published items can be superseded.");
  if (old.supersededBy) throw new AppError("A replacement draft already exists for this item.");
  const draft = await createDraft(actor, raw);
  await db.announcement.update({ where: { id: draft.id }, data: { supersedesId: oldId } });
  await audit(actor.id, "announcement.supersede_draft", "Announcement", oldId, { draftId: draft.id });
  return draft;
}

export async function markDuplicate(actor: Actor, id: string, duplicateOfId: string) {
  if (!can.publish(actor)) throw new ForbiddenError();
  if (id === duplicateOfId) throw new AppError("An item cannot duplicate itself.");
  const [a, b] = await Promise.all([db.announcement.findUnique({ where: { id } }), db.announcement.findUnique({ where: { id: duplicateOfId } })]);
  if (!a || !b) throw new NotFoundError();
  if (["PUBLISHED"].includes(a.status)) {
    await retractAnnouncement(actor, id, `Duplicate of “${b.headline}”. Merged into that item.`);
  }
  await db.announcement.update({ where: { id }, data: { duplicateOfId, ...(a.status === "PUBLISHED" ? {} : { status: "RETRACTED", retractionReason: `Duplicate of “${b.headline}”.` }) } });
  await audit(actor.id, "announcement.mark_duplicate", "Announcement", id, { duplicateOfId });
}

export async function correctionsLog(take = 100) {
  return db.correction.findMany({
    where: { OR: [{ announcement: { status: { in: [...PUBLIC] } } }, { metric: { status: { in: ["PUBLISHED", "SUPERSEDED", "RETRACTED"] } } }] },
    orderBy: { createdAt: "desc" },
    take,
    include: { announcement: { select: { id: true, headline: true, isFictional: true } }, metric: { select: { id: true, label: true, periodLabel: true, isFictional: true } } },
  });
}
