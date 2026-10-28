"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { destroySession, requireUser } from "@/server/auth";
import { deleteAccount } from "@/server/services/account";
import { changePassword } from "@/server/services/users";
import { AppError } from "@/lib/errors";
import { saveTextSettings } from "@/server/services/alert-text";
import { startProCheckout } from "@/server/connect/paystack";

export type SettingsState = { error?: string | null; ok?: string | null };

export async function updateProfileAction(_: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 80) return { error: "Name must be 2 to 80 characters." };
  await db.user.update({ where: { id: user.id }, data: { name } });
  return { ok: "Saved." };
}

export async function changePasswordAction(_: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await requireUser();
  try {
    await changePassword(user, String(form.get("current") ?? ""), String(form.get("next") ?? ""));
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  redirect("/login?changed=1");
}

export async function saveTextSettingsAction(_: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const r = await saveTextSettings(user.id, {
    phone: String(form.get("phone") ?? ""),
    textAlerts: form.get("textAlerts") === "1",
    priceDigest: form.get("priceDigest") === "1",
    digestState: String(form.get("digestState") ?? ""),
  });
  return r;
}

export async function startCheckoutAction(): Promise<SettingsState> {
  const user = await requireUser();
  let url: string;
  try {
    url = await startProCheckout(user);
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    console.error("checkout", e);
    return { error: "The payment page could not be opened. Try again in a minute." };
  }
  redirect(url);
}

export async function deleteAccountAction(_: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await requireUser();
  try {
    await deleteAccount(user, String(form.get("password") ?? ""), String(form.get("confirm") ?? ""));
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  await destroySession().catch(() => undefined);
  redirect("/account-deleted");
}
