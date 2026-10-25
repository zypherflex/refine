"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth";
import { changePassword } from "@/server/services/users";
import { AppError } from "@/lib/errors";

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
