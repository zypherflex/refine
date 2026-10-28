"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/server/auth";
import { enqueue, drainQueue } from "@/server/jobs";
import { jobHandlers } from "@/server/job-handlers";
import { audit } from "@/server/audit";

/** Approves or revokes an open-data source; readers only see series from approved sources. */
export async function approveSourceAction(form: FormData) {
  const admin = await requireRole("ADMIN");
  const id = String(form.get("id"));
  const approve = form.get("approve") === "1";
  await db.source.update({ where: { id }, data: { approved: approve, approvedById: admin.id, approvedAt: new Date() } });
  await audit(admin.id, approve ? "source.approve" : "source.revoke", "Source", id);
  revalidatePath("/admin/system");
  revalidatePath("/market");
}

/** Queues a refresh of every open-data feed. With inline jobs (the default) it runs straight away in this process. */
export async function refreshOpenDataAction() {
  const admin = await requireRole("ADMIN");
  const job = await enqueue("opendata.ingest", { actorId: admin.id }, admin.id);
  await audit(admin.id, "opendata.refresh_requested", "Job", job.id);
  if (process.env.INLINE_JOBS !== "false") void drainQueue(jobHandlers, 5).catch(() => undefined);
  revalidatePath("/admin");
}
