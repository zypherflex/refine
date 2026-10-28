"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireUser } from "@/server/auth";
import { AppError } from "@/lib/errors";
import { createKey, revokeKey, startTrial } from "@/server/data/accounts";
import { startDataCheckout } from "@/server/data/billing";

export type DataState = { error?: string | null; ok?: string | null; key?: string | null };

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
function message(e: unknown) {
  if (e instanceof ZodError) return e.issues.map((i) => i.message).join(" ");
  if (e instanceof AppError) return e.message;
  throw e;
}

export async function startTrialAction(_: DataState, form: FormData): Promise<DataState> {
  const user = await requireUser("/account/data");
  try {
    await startTrial(user, { organisation: s(form, "organisation"), billingCountry: s(form, "billingCountry") });
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath("/account/data");
  return { ok: "Your 14-day trial has started. Create an API key below." };
}

export async function createKeyAction(_: DataState, form: FormData): Promise<DataState> {
  const user = await requireUser("/account/data");
  try {
    const key = await createKey(user, s(form, "name"));
    revalidatePath("/account/data");
    return { key, ok: "Copy this key now. It will not be shown again." };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function revokeKeyAction(form: FormData) {
  const user = await requireUser("/account/data");
  await revokeKey(user, s(form, "keyId"));
  revalidatePath("/account/data");
}

export async function buyDataPlanAction(_: DataState, form: FormData): Promise<DataState> {
  const user = await requireUser("/account/data");
  let url: string;
  try {
    url = await startDataCheckout(user, s(form, "plan"), s(form, "period") === "year" ? "year" : "month");
  } catch (e) {
    return { error: message(e) };
  }
  redirect(url);
}
