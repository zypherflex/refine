"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth";
import { markRead } from "@/server/services/alerts";
import { setEmailAlerts } from "@/server/services/alert-email";
import { integrationStatus } from "@/server/integrations";
import { TOPICS } from "@/lib/labels";
import type { AlertFrequency } from "@prisma/client";

export async function saveWatchAction(form: FormData) {
  const user = await requireUser();
  const companyId = String(form.get("companyId"));
  if (!(await db.company.findUnique({ where: { id: companyId } }))) return;
  if (form.get("remove")) {
    await db.watchlist.deleteMany({ where: { userId: user.id, companyId } });
  } else {
    const topics = form.getAll("topics").map(String).filter((t) => (TOPICS as readonly string[]).includes(t));
    const f = String(form.get("frequency"));
    const frequency: AlertFrequency = f === "DAILY" || f === "WEEKLY" ? f : "IMMEDIATE";
    await db.watchlist.upsert({ where: { userId_companyId: { userId: user.id, companyId } }, update: { topics, frequency }, create: { userId: user.id, companyId, topics, frequency } });
  }
  revalidatePath("/watchlist");
}

export async function markReadAction(form: FormData) {
  const user = await requireUser();
  await markRead(user.id, String(form.get("id") ?? "") || undefined);
  revalidatePath("/watchlist");
}

export async function setEmailAlertsAction(form: FormData) {
  const user = await requireUser();
  if (!integrationStatus().email.available) return;
  await setEmailAlerts(user.id, form.get("enabled") === "on");
  revalidatePath("/watchlist");
}
