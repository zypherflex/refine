"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/server/auth";
import { AppError } from "@/lib/errors";
import { audit } from "@/server/audit";
import {
  correctAnnouncement, createDraft, createSupersedingDraft, markDuplicate, publishAnnouncement,
  retractAnnouncement, reviewAnnouncement, submitForReview, updateDraft, type AnnouncementInput,
} from "@/server/services/announcements";
import { correctMetric, publishMetric, rejectMetric } from "@/server/services/metrics";
import type { Provenance } from "@prisma/client";

export type EdState = { error?: string | null; ok?: string | null };

function msg(e: unknown): string {
  if (e instanceof ZodError) return e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" ");
  if (e instanceof AppError) return e.message;
  throw e;
}

function parseAnnouncement(form: FormData): AnnouncementInput {
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const excerpts = [0, 1, 2]
    .map((i) => ({ quote: s(`ex_quote_${i}`), documentId: s(`ex_doc_${i}`) || null, page: s(`ex_page_${i}`) ? Number(s(`ex_page_${i}`)) : null }))
    .filter((e) => e.quote);
  return {
    companyId: s("companyId"),
    legalEntityId: s("legalEntityId") || null,
    sourceId: s("sourceId") || null,
    headline: s("headline"),
    originalTitle: s("originalTitle"),
    publisher: s("publisher"),
    sourceUrl: s("sourceUrl"),
    documentType: s("documentType") as any,
    sourceVersion: s("sourceVersion") || "1",
    eventDate: (s("eventDate") || null) as any,
    sourcePublishedAt: s("sourcePublishedAt") as any,
    provenance: s("provenance") as any,
    summary: s("summary"),
    whatChanged: s("whatChanged"),
    whyItMatters: s("whyItMatters"),
    uncertainties: s("uncertainties"),
    analysis: s("analysis"),
    alternativeExplanations: s("alternativeExplanations"),
    openQuestions: s("openQuestions"),
    topics: form.getAll("topics").map(String),
    aiGenerated: form.get("aiGenerated") === "on",
    isFictional: form.get("isFictional") === "on",
    excerpts,
  };
}

export async function saveDraftAction(_: EdState, form: FormData): Promise<EdState> {
  const user = await requireRole("ANALYST");
  const id = String(form.get("id") ?? "");
  const supersedes = String(form.get("supersedesId") ?? "");
  let target = id;
  try {
    const input = parseAnnouncement(form);
    if (id) await updateDraft(user, id, input);
    else if (supersedes) target = (await createSupersedingDraft(user, supersedes, input)).id;
    else target = (await createDraft(user, input)).id;
  } catch (e) {
    return { error: msg(e) };
  }
  redirect(`/editorial/announcements/${target}?saved=1`);
}

export async function workflowAction(_: EdState, form: FormData): Promise<EdState> {
  const user = await requireRole("ANALYST");
  const id = String(form.get("id"));
  const op = String(form.get("op"));
  try {
    if (op === "submit") await submitForReview(user, id);
    else if (op === "approve" || op === "request_changes" || op === "reject") await reviewAnnouncement(user, id, op === "approve" ? "APPROVE" : op === "reject" ? "REJECT" : "REQUEST_CHANGES", String(form.get("notes") ?? ""));
    else if (op === "publish") await publishAnnouncement(user, id);
    else if (op === "retract") await retractAnnouncement(user, id, String(form.get("reason") ?? ""));
    else if (op === "duplicate") await markDuplicate(user, id, String(form.get("duplicateOfId") ?? ""));
    else if (op === "correct") {
      const changes: Record<string, unknown> = {};
      for (const k of ["headline", "summary", "whatChanged", "whyItMatters", "uncertainties", "analysis", "alternativeExplanations", "openQuestions", "sourceUrl", "originalTitle"]) {
        const v = form.get(k);
        if (v !== null) changes[k] = String(v).trim();
      }
      for (const k of ["eventDate", "sourcePublishedAt"]) {
        const v = String(form.get(k) ?? "");
        if (v) changes[k] = new Date(v);
      }
      await correctAnnouncement(user, id, changes, String(form.get("correctionSummary") ?? ""));
    } else return { error: "Unknown action" };
  } catch (e) {
    return { error: msg(e) };
  }
  revalidatePath(`/editorial/announcements/${id}`);
  revalidatePath("/editorial");
  return { ok: { submit: "Submitted for review.", approve: "Approved. It can now be published.", request_changes: "Returned to draft with your notes.", reject: "Rejected and returned to draft.", publish: "Published. Watchers and matching theses have been notified.", retract: "Retracted. Watchers have been notified.", duplicate: "Marked as duplicate.", correct: "Correction published and logged. Watchers and affected theses have been notified." }[op] ?? "Done." };
}

export async function metricAction(_: EdState, form: FormData): Promise<EdState> {
  const user = await requireRole("EDITOR");
  const id = String(form.get("id"));
  const op = String(form.get("op"));
  try {
    if (op === "publish") await publishMetric(user, id);
    else if (op === "reject") await rejectMetric(user, id);
    else if (op === "correct") {
      const num = (k: string) => (form.get(k) === null || String(form.get(k)) === "" ? undefined : Number(form.get(k)));
      const str = (k: string) => (form.get(k) === null ? undefined : String(form.get(k)).trim());
      const date = (k: string) => (str(k) ? new Date(str(k)!) : undefined);
      await correctMetric(
        user,
        id,
        { value: num("value"), periodLabel: str("periodLabel"), periodType: str("periodType"), scope: str("scope") as any, auditStatus: str("auditStatus") as any, page: num("page"), currency: str("currency") || undefined, scale: str("scale"), periodStart: date("periodStart"), periodEnd: date("periodEnd") },
        String(form.get("summary") ?? ""),
      );
    }
  } catch (e) {
    return { error: msg(e) };
  }
  revalidatePath("/editorial/documents");
  return { ok: op === "publish" ? "Figure published." : op === "reject" ? "Figure discarded." : "Saved and logged." };
}

export async function approveSourceAction(form: FormData) {
  const user = await requireRole("EDITOR");
  const id = String(form.get("id"));
  await db.source.update({ where: { id }, data: { approved: form.get("approve") === "1", approvedById: user.id, approvedAt: new Date() } });
  await audit(user.id, form.get("approve") === "1" ? "source.approve" : "source.revoke", "Source", id);
  revalidatePath("/editorial/sources");
}

export async function createSourceAction(form: FormData) {
  const user = await requireRole("EDITOR");
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2) return;
  const s = await db.source.create({
    data: { name, publisher: String(form.get("publisher") || name), homepageUrl: String(form.get("homepageUrl") ?? ""), provenance: String(form.get("provenance")) as Provenance, licenseNotes: String(form.get("licenseNotes") ?? "") },
  });
  await audit(user.id, "source.create", "Source", s.id);
  revalidatePath("/editorial/sources");
}

export async function conflictAction(form: FormData) {
  const user = await requireRole("EDITOR");
  const op = String(form.get("op"));
  if (op === "create") {
    const s = (k: string) => String(form.get(k) ?? "").trim();
    if (!s("topic") || !s("claimA") || !s("claimB")) return;
    const c = await db.sourceConflict.create({
      data: {
        companyId: s("companyId"),
        topic: s("topic"),
        description: s("description") || "Sources disagree. Both claims are shown.",
        status: "UNRESOLVED",
        flaggedById: user.id,
        claims: {
          create: [
            { claim: s("claimA"), sourceLabel: s("sourceA"), sourceDate: new Date(s("dateA") || Date.now()), provenance: s("provA") as Provenance, announcementId: s("annA") || null },
            { claim: s("claimB"), sourceLabel: s("sourceB"), sourceDate: new Date(s("dateB") || Date.now()), provenance: s("provB") as Provenance, announcementId: s("annB") || null },
          ],
        },
      },
    });
    await audit(user.id, "conflict.flag", "SourceConflict", c.id);
  } else {
    const id = String(form.get("id"));
    const status = op === "publish" ? "UNRESOLVED" : "RESOLVED";
    await db.sourceConflict.update({ where: { id }, data: { status, resolution: String(form.get("resolution") ?? "") } });
    await audit(user.id, `conflict.${op}`, "SourceConflict", id);
  }
  revalidatePath("/editorial/conflicts");
}

export async function publishRiskAction(form: FormData) {
  const user = await requireRole("EDITOR");
  const id = String(form.get("id"));
  await db.risk.update({ where: { id }, data: { status: form.get("unpublish") ? "DRAFT" : "PUBLISHED" } });
  await audit(user.id, "risk.publish", "Risk", id);
  revalidatePath("/editorial");
}
