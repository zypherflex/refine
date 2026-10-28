"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth";
import { deletePrivateDocument, uploadDocument, approveDocument, processDocument } from "@/server/services/documents";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/server/rate-limit";
import { drainQueue } from "@/server/jobs";
import { jobHandlers } from "@/server/job-handlers";
import type { DocumentType, Provenance } from "@prisma/client";

export type UploadState = { error?: string | null; ok?: string | null };

async function readFile(form: FormData) {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw new AppError("Choose a file to upload.");
  return { name: file.name, data: Buffer.from(await file.arrayBuffer()) };
}

/** Kick the queue in-process so a single-server deployment processes uploads without a separate worker. */
function kickQueue() {
  if (process.env.INLINE_JOBS !== "false") void drainQueue(jobHandlers, 5).catch(() => undefined);
}

export async function uploadPrivateAction(_: UploadState, form: FormData): Promise<UploadState> {
  const user = await requireUser();
  if (!rateLimit(`upload:${user.id}`, 20, 60 * 60_000)) return { error: "Upload limit reached. Try again in an hour." };
  try {
    const file = await readFile(form);
    await uploadDocument(user, file, { title: String(form.get("title") || file.name), companyId: String(form.get("companyId") || "") || null }, "PRIVATE");
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  kickQueue();
  revalidatePath("/library");
  return { ok: "Uploaded. Text extraction runs in the background; the file is visible only to you." };
}

export async function uploadPublicAction(_: UploadState, form: FormData): Promise<UploadState> {
  const user = await requireUser();
  try {
    const file = await readFile(form);
    await uploadDocument(
      user,
      file,
      {
        title: String(form.get("title") || file.name),
        companyId: String(form.get("companyId") || "") || null,
        sourceId: String(form.get("sourceId") || "") || null,
        documentType: (String(form.get("documentType") || "OTHER") as DocumentType),
        publisher: String(form.get("publisher") || ""),
        url: String(form.get("url") || ""),
        publishedAt: form.get("publishedAt") ? new Date(String(form.get("publishedAt"))) : null,
        provenance: (String(form.get("provenance") || "UNVERIFIED") as Provenance),
        topics: form.getAll("topics").map(String),
      },
      "PUBLIC",
    );
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  kickQueue();
  revalidatePath("/editorial/documents");
  return { ok: "Uploaded and queued for extraction. Review the extracted figures before approving." };
}

export async function deletePrivateAction(form: FormData) {
  const user = await requireUser();
  await deletePrivateDocument(user, String(form.get("id")));
  revalidatePath("/library");
}

export async function approveDocumentAction(form: FormData) {
  const user = await requireUser();
  await approveDocument(user, String(form.get("id")), String(form.get("notes") ?? ""));
  revalidatePath("/editorial/documents");
}

export async function reprocessDocumentAction(form: FormData) {
  const user = await requireUser();
  if (user.role !== "EDITOR" && user.role !== "ADMIN") return;
  await processDocument(String(form.get("id"))).catch(() => undefined);
  revalidatePath("/editorial/documents");
}
