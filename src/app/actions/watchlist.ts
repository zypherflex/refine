"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth";
import { markRead } from "@/server/services/alerts";
import { setEmailAlerts } from "@/server/services/alert-email";
import { integrationStatus } from "@/server/integrations";

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
