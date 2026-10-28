"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/server/auth";
import { enqueue, drainQueue } from "@/server/jobs";
import { jobHandlers } from "@/server/job-handlers";
import { audit } from "@/server/audit";
import { reviewNewsLead } from "@/server/services/market";

export async function newsLeadAction(form: FormData) {
  const user = await requireRole("ANALYST");
  const id = String(form.get("id"));
  const op = String(form.get("op"));
  if (op === "draft") {
    await reviewNewsLead(user, id, "DRAFTED");
    redirect(`/editorial/announcements/new?lead=${encodeURIComponent(id)}`);
  }
  await reviewNewsLead(user, id, op === "restore" ? "NEW" : "DISMISSED");
  revalidatePath("/editorial/news-leads");
}

/** Queues a refresh of every open-data feed. With inline jobs (the default) it runs straight away in this process. */
export async function refreshOpenDataAction() {
  const admin = await requireRole("ADMIN");
  const job = await enqueue("opendata.ingest", { actorId: admin.id }, admin.id);
  await audit(admin.id, "opendata.refresh_requested", "Job", job.id);
  if (process.env.INLINE_JOBS !== "false") void drainQueue(jobHandlers, 5).catch(() => undefined);
  revalidatePath("/admin");
}
