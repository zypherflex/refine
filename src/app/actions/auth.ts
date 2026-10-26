"use server";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { createSession, destroySession, clientIp } from "@/server/auth";
import { registerUser, verifyCredentials } from "@/server/services/users";
import { rateLimit } from "@/server/rate-limit";
import { AppError } from "@/lib/errors";
import { audit } from "@/server/audit";

export type FormState = { error?: string | null; ok?: string | null };

function safeNext(n: FormDataEntryValue | null) {
  const s = typeof n === "string" ? n : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/opportunities";
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const ip = await clientIp();
  if (!rateLimit(`login:${ip}`, 20, 15 * 60_000) || !rateLimit(`login:${email}`, 8, 15 * 60_000)) {
    return { error: "Too many sign-in attempts. Wait 15 minutes and try again." };
  }
  const user = await verifyCredentials(email, password);
  if (!user) return { error: "That email and password do not match an account." };
  await createSession(user.id);
  await audit(user.id, "user.login", "User", user.id);
  redirect(safeNext(form.get("next")));
}

export async function registerAction(_: FormState, form: FormData): Promise<FormState> {
  const ip = await clientIp();
  if (!rateLimit(`register:${ip}`, 10, 60 * 60_000)) return { error: "Too many sign-ups from this network. Try again later." };
  try {
    const user = await registerUser({ name: String(form.get("name") ?? ""), email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") });
    await createSession(user.id);
  } catch (e) {
    if (e instanceof ZodError) return { error: e.issues.map((i) => i.message).join(" ") };
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  redirect("/opportunities?welcome=1");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
