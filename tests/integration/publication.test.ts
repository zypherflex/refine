import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  correctAnnouncement, createDraft, createSupersedingDraft, getAnnouncement, listAnnouncements, publicationBlockers,
  publishAnnouncement, retractAnnouncement, reviewAnnouncement, submitForReview, updateDraft,
} from "@/server/services/announcements";
import { createThesis, getThesis, reviewSuggestion } from "@/server/services/thesis";
import { baseAnnouncement, company, resetDb, source, user } from "../helpers";

async function publishFlow(editor: { id: string; role: any }, input: ReturnType<typeof baseAnnouncement>) {
  const d = await createDraft(editor, input);
  await submitForReview(editor, d.id);
  await reviewAnnouncement(editor, d.id, "APPROVE");
  return publishAnnouncement(editor, d.id);
}

describe("editorial publication workflow", () => {
  beforeEach(resetDb);

  it("keeps drafts hidden from readers and requires review before publishing", async () => {
    const [editor, reader, co, src] = await Promise.all([user("EDITOR"), user("USER"), company(), source()]);
    const d = await createDraft(editor, { ...baseAnnouncement(co.id, src.id), aiGenerated: true });
    await expect(getAnnouncement(reader, d.id)).rejects.toThrow(/not found/i);
    expect(await listAnnouncements(reader, { companyId: co.id })).toHaveLength(0);
    await expect(publishAnnouncement(editor, d.id)).rejects.toThrow(/submitted for review/);
    await submitForReview(editor, d.id);
    await expect(publishAnnouncement(editor, d.id)).rejects.toThrow(/approve/);
    await reviewAnnouncement(editor, d.id, "APPROVE", "Checked against p.1");
    await publishAnnouncement(editor, d.id);
    const seen = await getAnnouncement(reader, d.id);
    expect(seen.status).toBe("PUBLISHED");
    expect(seen.reviews[0].decision).toBe("APPROVE");
  });

  it("blocks users and analysts from publishing", async () => {
    const [analyst, reader, co] = await Promise.all([user("ANALYST"), user("USER"), company()]);
    await expect(createDraft(reader, baseAnnouncement(co.id))).rejects.toThrow(/permission/);
    const d = await createDraft(analyst, baseAnnouncement(co.id));
    await submitForReview(analyst, d.id);
    await expect(reviewAnnouncement(analyst, d.id, "APPROVE")).rejects.toThrow(/editors/i);
    await expect(publishAnnouncement(analyst, d.id)).rejects.toThrow(/editors/i);
  });

  it("requires an approved source and a supporting excerpt", async () => {
    const [editor, co, unapproved] = await Promise.all([user("EDITOR"), company(), source(false)]);
    const d = await createDraft(editor, { ...baseAnnouncement(co.id, unapproved.id), excerpts: [] });
    await submitForReview(editor, d.id);
    await reviewAnnouncement(editor, d.id, "APPROVE");
    const blockers = await publicationBlockers(d.id);
    expect(blockers.join(" ")).toMatch(/excerpt/);
    expect(blockers.join(" ")).toMatch(/not been approved/);
    await expect(publishAnnouncement(editor, d.id)).rejects.toThrow(/Cannot publish/);
  });

  it("invalidates an approval when the draft is edited afterwards", async () => {
    const [editor, co] = await Promise.all([user("EDITOR"), company()]);
    const d = await createDraft(editor, baseAnnouncement(co.id));
    await submitForReview(editor, d.id);
    await reviewAnnouncement(editor, d.id, "APPROVE");
    await updateDraft(editor, d.id, { headline: "Edited after approval" });
    const a = await db.announcement.findUniqueOrThrow({ where: { id: d.id } });
    expect(a.status).toBe("DRAFT");
    expect(a.reviewerId).toBeNull();
  });

  it("publishes, alerts watchers once, suggests the item against a matching thesis, and logs a later correction", async () => {
    const [editor, investor, co] = await Promise.all([user("EDITOR"), user("USER"), company()]);
    await db.watchlist.create({ data: { userId: investor.id, companyId: co.id } });
    const thesis = await createThesis(investor, {
      companyId: co.id,
      title: "Utilization thesis",
      rationale: "Higher utilization should lift cash flow.",
      assumptions: [{ statement: "Improved utilization should support operating cash flow.", topics: ["utilization", "cash-flow"] }, { statement: "Debt is manageable", topics: ["debt"] }],
    });
    const pub = await publishFlow(editor, baseAnnouncement(co.id));

    const alerts = await db.alert.findMany({ where: { userId: investor.id } });
    expect(alerts.map((a) => a.kind).sort()).toEqual(["NEW_ANNOUNCEMENT", "THESIS_MATCH"]);
    const t = await getThesis(investor, thesis.id);
    const pending = t.evidence.filter((e) => e.status === "PENDING_REVIEW");
    expect(pending).toHaveLength(1);
    expect(pending[0].assumption?.statement).toMatch(/utilization/);
    // The thesis text itself is untouched.
    expect(t.version).toBe(1);
    expect(t.rationale).toBe("Higher utilization should lift cash flow.");

    await reviewSuggestion(investor, pending[0].id, "SUPPORTS", "Good sign");

    // Correct the published item.
    await expect(correctAnnouncement(editor, pub.id, { headline: "x" }, "short")).rejects.toThrow(/10 characters/);
    const corrected = await correctAnnouncement(editor, pub.id, { summary: "The company reported average Q3 throughput of 380,000 bpd." }, "Throughput figure corrected from 400,000 to 380,000 bpd per page 2.");
    expect(corrected.revision).toBe(2);
    const log = await db.correction.findMany({ where: { announcementId: pub.id } });
    expect(log).toHaveLength(1);
    expect((log[0].before as any).summary).toContain("400,000");
    expect((log[0].after as any).summary).toContain("380,000");

    const after = await db.alert.findMany({ where: { userId: investor.id }, orderBy: { createdAt: "asc" } });
    expect(after.map((a) => a.kind)).toContain("CORRECTION");
    // The accepted suggestion goes back to the user for review because the evidence changed.
    const ev = await db.thesisEvidence.findFirstOrThrow({ where: { thesisId: thesis.id } });
    expect(ev.status).toBe("PENDING_REVIEW");
    expect(ev.matchReason).toMatch(/corrected/);
  });

  it("deduplicates alerts for the same event", async () => {
    const [editor, investor, co] = await Promise.all([user("EDITOR"), user("USER"), company()]);
    await db.watchlist.create({ data: { userId: investor.id, companyId: co.id } });
    const pub = await publishFlow(editor, baseAnnouncement(co.id));
    const { notifyWatchers } = await import("@/server/services/alerts");
    await notifyWatchers(pub, "NEW_ANNOUNCEMENT", "again");
    await notifyWatchers(pub, "NEW_ANNOUNCEMENT", "again");
    expect(await db.alert.count({ where: { userId: investor.id, kind: "NEW_ANNOUNCEMENT" } })).toBe(1);
  });

  it("respects topic filters and digest frequency on watchlists", async () => {
    const [editor, a, b, co] = await Promise.all([user("EDITOR"), user(), user(), company()]);
    await db.watchlist.create({ data: { userId: a.id, companyId: co.id, topics: ["debt"] } });
    await db.watchlist.create({ data: { userId: b.id, companyId: co.id, frequency: "WEEKLY" } });
    await publishFlow(editor, baseAnnouncement(co.id));
    expect(await db.alert.count({ where: { userId: a.id } })).toBe(0);
    const weekly = await db.alert.findFirstOrThrow({ where: { userId: b.id } });
    expect(weekly.visibleAt.getTime()).toBeGreaterThan(Date.now());
    expect(weekly.visibleAt.getUTCDay()).toBe(1);
  });

  it("retracts with a public reason and keeps the item visible", async () => {
    const [editor, reader, co] = await Promise.all([user("EDITOR"), user(), company()]);
    const pub = await publishFlow(editor, baseAnnouncement(co.id));
    await expect(retractAnnouncement(editor, pub.id, "")).rejects.toThrow(/reason/);
    await retractAnnouncement(editor, pub.id, "The source withdrew the report.");
    const seen = await getAnnouncement(reader, pub.id);
    expect(seen.status).toBe("RETRACTED");
    expect(seen.retractionReason).toMatch(/withdrew/);
    expect(seen.corrections[0].kind).toBe("RETRACTION");
  });

  it("supersedes a published item only when the replacement is published", async () => {
    const [editor, co] = await Promise.all([user("EDITOR"), company()]);
    const old = await publishFlow(editor, baseAnnouncement(co.id));
    const draft = await createSupersedingDraft(editor, old.id, { ...baseAnnouncement(co.id), headline: "Revised: throughput was 380,000 bpd" });
    expect((await db.announcement.findUniqueOrThrow({ where: { id: old.id } })).status).toBe("PUBLISHED");
    await submitForReview(editor, draft.id);
    await reviewAnnouncement(editor, draft.id, "APPROVE");
    await publishAnnouncement(editor, draft.id);
    const o = await db.announcement.findUniqueOrThrow({ where: { id: old.id }, include: { supersededBy: true } });
    expect(o.status).toBe("SUPERSEDED");
    expect(o.supersededBy?.id).toBe(draft.id);
    expect(await db.correction.count({ where: { announcementId: old.id, kind: "SUPERSESSION" } })).toBe(1);
  });
});
