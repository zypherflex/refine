import { createHash } from "node:crypto";
import type { DocumentType, Prisma, Provenance } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { can, canAccessDocument, type Actor } from "@/lib/permissions";
import { audit } from "../audit";
import { enqueue } from "../jobs";
import { storage } from "../storage";
import { sniffFile } from "../upload-validation";
import { extractFigures, extractPages } from "../extraction";

export type UploadMeta = {
  title: string;
  companyId?: string | null;
  sourceId?: string | null;
  documentType?: DocumentType;
  publisher?: string;
  url?: string;
  publishedAt?: Date | null;
  provenance?: Provenance;
  topics?: string[];
};

/**
 * Stores an uploaded file and queues it for extraction.
 * visibility PUBLIC requires an editor; PRIVATE uploads belong only to the uploader.
 */
export async function uploadDocument(actor: Actor, file: { name: string; data: Buffer }, meta: UploadMeta, visibility: "PUBLIC" | "PRIVATE") {
  if (visibility === "PUBLIC" && !can.uploadPublicDocument(actor)) throw new ForbiddenError("Only editors can add documents to the public library.");
  const check = sniffFile(file.name, file.data);
  if (!check.ok) throw new AppError(check.reason);
  const title = meta.title.trim().slice(0, 300);
  if (title.length < 3) throw new AppError("Give the document a title.");
  const prefix = visibility === "PRIVATE" ? `private/${actor.id.toLowerCase()}` : "library/public";
  const key = await storage().put(prefix, file.data, check.kind);
  const doc = await db.document.create({
    data: {
      title,
      companyId: meta.companyId || null,
      sourceId: meta.sourceId || null,
      documentType: meta.documentType ?? "OTHER",
      publisher: meta.publisher?.trim() ?? "",
      url: meta.url?.trim() ?? "",
      publishedAt: meta.publishedAt ?? null,
      provenance: visibility === "PRIVATE" ? "USER_ASSUMPTION" : (meta.provenance ?? "UNVERIFIED"),
      topics: meta.topics ?? [],
      visibility,
      ownerId: visibility === "PRIVATE" ? actor.id : null,
      storageKey: key,
      originalName: file.name.slice(0, 200),
      mimeType: check.kind === "pdf" ? "application/pdf" : check.kind === "csv" ? "text/csv" : "text/plain",
      sizeBytes: file.data.length,
      sha256: createHash("sha256").update(file.data).digest("hex"),
      status: "UPLOADED",
    },
  });
  await enqueue("document.extract", { documentId: doc.id }, actor.id);
  await audit(actor.id, "document.upload", "Document", doc.id, { visibility, size: file.data.length });
  return doc;
}

/** The single gate for reading a document or its pages. Unauthorised access looks like "not found". */
export async function getDocumentForActor(actor: Actor | null, id: string) {
  const doc = await db.document.findUnique({ where: { id }, include: { company: true, source: true } });
  if (!doc || !canAccessDocument(actor, doc)) throw new NotFoundError("Document not found");
  return doc;
}

export async function getDocumentPage(actor: Actor | null, id: string, page: number) {
  const doc = await getDocumentForActor(actor, id);
  const p = await db.documentPage.findUnique({ where: { documentId_pageNumber: { documentId: id, pageNumber: page } } });
  return { doc, page: p };
}

export async function readDocumentFile(actor: Actor | null, id: string) {
  const doc = await getDocumentForActor(actor, id);
  if (!doc.storageKey) throw new NotFoundError("This document has no downloadable file.");
  const data = await storage().get(doc.storageKey);
  if (actor) await audit(actor.id, "document.download", "Document", id);
  return { doc, data };
}

export type LibraryFilters = { companyId?: string; topic?: string; sourceId?: string; documentType?: DocumentType; status?: string; from?: Date; to?: Date; q?: string; provenance?: Provenance };

export async function listLibrary(actor: Actor, f: LibraryFilters = {}) {
  const staff = can.viewEditorial(actor);
  const where: Prisma.DocumentWhereInput = {
    visibility: "PUBLIC",
    ...(staff ? (f.status ? { status: f.status as any } : {}) : { status: "APPROVED" }),
    ...(f.companyId ? { companyId: f.companyId } : {}),
    ...(f.topic ? { topics: { has: f.topic } } : {}),
    ...(f.sourceId ? { sourceId: f.sourceId } : {}),
    ...(f.documentType ? { documentType: f.documentType } : {}),
    ...(f.provenance ? { provenance: f.provenance } : {}),
    ...(f.from || f.to ? { publishedAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) } } : {}),
    ...(f.q ? { OR: [{ title: { contains: f.q, mode: "insensitive" } }, { publisher: { contains: f.q, mode: "insensitive" } }] } : {}),
  };
  return db.document.findMany({ where, orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }], include: { company: true, source: true }, take: 200 });
}

export async function listPrivateDocuments(actor: Actor) {
  return db.document.findMany({ where: { visibility: "PRIVATE", ownerId: actor.id }, orderBy: { createdAt: "desc" } });
}

export async function deletePrivateDocument(actor: Actor, id: string) {
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc || doc.visibility !== "PRIVATE" || doc.ownerId !== actor.id) throw new NotFoundError();
  if (doc.storageKey) await storage().remove(doc.storageKey);
  await db.citation.deleteMany({ where: { documentId: id } });
  await db.document.delete({ where: { id } });
  await audit(actor.id, "document.delete", "Document", id);
}

export async function approveDocument(actor: Actor, id: string, notes = "") {
  if (!can.publish(actor)) throw new ForbiddenError();
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc || doc.visibility !== "PUBLIC") throw new NotFoundError();
  if (doc.status !== "EXTRACTED") throw new AppError("Only extracted documents can be approved.");
  await db.$transaction(async (tx) => {
    await tx.document.update({ where: { id }, data: { status: "APPROVED" } });
    await tx.editorialReview.create({ data: { documentId: id, reviewerId: actor.id, decision: "APPROVE", notes } });
    await audit(actor.id, "document.approve", "Document", id, undefined, tx);
  });
}

/**
 * Background job: extract page text and candidate figures. Figures from public documents become DRAFT
 * metrics for editorial checking; private documents never create shared metrics.
 */
export async function processDocument(documentId: string) {
  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc || !doc.storageKey) return;
  if (!["UPLOADED", "FAILED", "PROCESSING"].includes(doc.status)) return;
  await db.document.update({ where: { id: documentId }, data: { status: "PROCESSING" } });
  try {
    const data = await storage().get(doc.storageKey);
    const kind = doc.mimeType === "application/pdf" ? "pdf" : doc.mimeType === "text/csv" ? "csv" : "txt";
    const pages = await extractPages(kind, data);
    const figures = doc.visibility === "PUBLIC" ? extractFigures(pages) : [];
    await db.$transaction(async (tx) => {
      await tx.documentPage.deleteMany({ where: { documentId } });
      await tx.documentPage.createMany({ data: pages.map((text, i) => ({ documentId, pageNumber: i + 1, text: text.slice(0, 50_000) })) });
      if (doc.companyId) {
        for (const f of figures) {
          await tx.metric.create({
            data: {
              companyId: doc.companyId,
              key: f.key,
              category: "FINANCIAL",
              label: f.label,
              value: f.value,
              unit: f.currency ?? "",
              currency: f.currency,
              scale: f.scale,
              periodLabel: "Needs editor input",
              periodType: "UNKNOWN",
              scope: "GROUP",
              auditStatus: "NOT_APPLICABLE",
              valueType: "REPORTED",
              provenance: doc.provenance,
              documentId,
              page: f.page,
              excerpt: f.excerpt,
              status: "DRAFT",
              notes: "Automatically extracted. Check value, period, scope and audit status against the cited page before publishing.",
              isFictional: doc.isFictional,
            },
          });
        }
      }
      await tx.document.update({
        where: { id: documentId },
        data: { status: "EXTRACTED", pageCount: pages.length, processingNote: `${pages.length} page(s) extracted${figures.length ? `, ${figures.length} candidate figure(s) drafted for review` : ""}.` },
      });
    });
  } catch (e) {
    await db.document.update({ where: { id: documentId }, data: { status: "FAILED", processingNote: `Extraction failed: ${(e as Error).message.slice(0, 300)}` } });
    throw e;
  }
}
