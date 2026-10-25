import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * A small Postgres-backed job queue. Jobs are claimed with FOR UPDATE SKIP LOCKED so several workers
 * can run safely. Job payloads only ever contain ids; handlers re-check permissions and state.
 */
export async function enqueue(type: string, payload: Prisma.InputJsonValue, createdById?: string) {
  return db.job.create({ data: { type, payload, createdById } });
}

export type JobHandler = (payload: any) => Promise<void>;

export async function claimNext(): Promise<{ id: string; type: string; payload: any; attempts: number; maxAttempts: number } | null> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    UPDATE "Job" SET status = 'RUNNING', "lockedAt" = now(), attempts = attempts + 1
    WHERE id = (
      SELECT id FROM "Job" WHERE status = 'QUEUED' AND "runAt" <= now()
      ORDER BY "runAt" ASC FOR UPDATE SKIP LOCKED LIMIT 1
    ) RETURNING id`;
  if (rows.length === 0) return null;
  return db.job.findUnique({ where: { id: rows[0].id } });
}

export async function runJob(job: { id: string; type: string; payload: any; attempts: number; maxAttempts: number }, handlers: Record<string, JobHandler>) {
  const handler = handlers[job.type];
  try {
    if (!handler) throw new Error(`No handler for job type ${job.type}`);
    await handler(job.payload);
    await db.job.update({ where: { id: job.id }, data: { status: "DONE", finishedAt: new Date(), error: "" } });
  } catch (e) {
    const failed = job.attempts >= job.maxAttempts;
    await db.job.update({
      where: { id: job.id },
      data: {
        status: failed ? "FAILED" : "QUEUED",
        error: (e as Error).message.slice(0, 1000),
        runAt: new Date(Date.now() + 30_000 * job.attempts),
        finishedAt: failed ? new Date() : null,
      },
    });
  }
}

/** Drains the queue in-process. Used by the worker loop and by tests. */
export async function drainQueue(handlers: Record<string, JobHandler>, max = 50) {
  for (let i = 0; i < max; i++) {
    const job = await claimNext();
    if (!job) return i;
    await runJob(job, handlers);
  }
  return max;
}
