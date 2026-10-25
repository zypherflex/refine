import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { topicLabel } from "@/lib/labels";
import { createAlert } from "./alerts";

type Ann = {
  id: string;
  companyId: string;
  headline: string;
  summary: string;
  topics: string[];
  alternativeExplanations: string;
  openQuestions: string;
  revision: number;
};

/**
 * When an announcement is published (or corrected), suggest it as evidence for review against every
 * thesis on that company whose assumptions track an overlapping topic. Suggestions are never applied
 * automatically: the user accepts, labels (supports / challenges) or dismisses them.
 */
export async function suggestEvidenceForTheses(ann: Ann, tx: Prisma.TransactionClient = db, reason: "published" | "corrected" = "published") {
  const theses = await tx.thesis.findMany({ where: { companyId: ann.companyId }, include: { assumptions: true } });
  let created = 0;
  for (const thesis of theses) {
    for (const a of thesis.assumptions) {
      const overlap = a.topics.filter((t) => ann.topics.includes(t));
      if (overlap.length === 0) continue;
      const matchReason = `This ${reason === "corrected" ? "corrected " : ""}disclosure covers ${overlap
        .map((t) => topicLabel[t] ?? t)
        .join(", ")
        .toLowerCase()}, which your assumption tracks.`;
      const existing = await tx.thesisEvidence.findUnique({
        where: { thesisId_assumptionId_announcementId: { thesisId: thesis.id, assumptionId: a.id, announcementId: ann.id } },
      });
      if (existing) {
        if (reason === "corrected") {
          // The underlying information changed: put it back in front of the user.
          await tx.thesisEvidence.update({ where: { id: existing.id }, data: { status: "PENDING_REVIEW", matchReason } });
        } else continue;
      } else {
        await tx.thesisEvidence.create({
          data: {
            thesisId: thesis.id,
            assumptionId: a.id,
            announcementId: ann.id,
            origin: "SUGGESTED",
            status: "PENDING_REVIEW",
            stance: "UNCLEAR",
            matchReason,
            alternativeExplanations: ann.alternativeExplanations,
            questions: ann.openQuestions,
          },
        });
      }
      created++;
      await createAlert(
        {
          userId: thesis.ownerId,
          kind: "THESIS_MATCH",
          title: `${reason === "corrected" ? "Corrected evidence" : "New evidence"} for “${thesis.title}”`,
          body: `“${ann.headline}” may be relevant to your assumption: “${a.statement}”. Review it to decide whether it supports or challenges the assumption.`,
          link: `/thesis/${thesis.id}#suggestions`,
          dedupeKey: `THESIS_MATCH:${thesis.id}:${a.id}:${ann.id}:r${ann.revision}`,
        },
        tx,
      );
    }
  }
  return created;
}
