import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { REVENUE_LINES } from "@/lib/hub/plans";

const lineIds = REVENUE_LINES.map((l) => l.id) as [string, ...string[]];
export const interestInput = z.object({ line: z.enum(lineIds), message: z.string().trim().max(1000).default("") });

/** Records that a user wants a paid service. No payment is taken in this release. */
export async function registerInterest(actor: Actor, raw: z.input<typeof interestInput>) {
  const input = interestInput.parse(raw);
  if (REVENUE_LINES.find((l) => l.id === input.line)!.when !== "NOW") throw new AppError("This service needs a licensed partner and is not open for sign-up yet.");
  return db.planInterest.upsert({ where: { userId_line: { userId: actor.id, line: input.line } }, update: { message: input.message }, create: { userId: actor.id, ...input } });
}

export async function myInterests(actor: Actor) {
  return (await db.planInterest.findMany({ where: { userId: actor.id }, select: { line: true } })).map((r) => r.line);
}

export async function interestCounts() {
  const rows = await db.planInterest.groupBy({ by: ["line"], _count: { _all: true } });
  return Object.fromEntries(rows.map((r) => [r.line, r._count._all])) as Record<string, number>;
}
