"use server";
import { revalidatePath } from "next/cache";
import type { Plan, Role } from "@prisma/client";
import { requireRole } from "@/server/auth";
import { revokeSessions, setUserAudience, setUserPlan, setUserRole } from "@/server/admin/users";

const s = (form: FormData, k: string) => String(form.get(k) ?? "");

/** Admin actions return nothing on purpose: the pages re-render with the new state, and errors are logged. */
function refresh(userId: string) {
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
}

export async function changeRoleAction(form: FormData) {
  const admin = await requireRole("ADMIN");
  const role = s(form, "role") as Role;
  if (!["USER", "ANALYST", "EDITOR", "ADMIN"].includes(role)) return;
  await setUserRole(admin, s(form, "userId"), role).catch((e) => console.error("change role", e));
  refresh(s(form, "userId"));
}

export async function changePlanAction(form: FormData) {
  const admin = await requireRole("ADMIN");
  await setUserPlan(admin, s(form, "userId"), s(form, "plan") as Plan).catch((e) => console.error("change plan", e));
  refresh(s(form, "userId"));
}

export async function changeAudienceAction(form: FormData) {
  const admin = await requireRole("ADMIN");
  const a = s(form, "audience");
  if (a !== "PERSONAL" && a !== "BUSINESS") return;
  await setUserAudience(admin, s(form, "userId"), a);
  refresh(s(form, "userId"));
}

export async function revokeSessionsAction(form: FormData) {
  const admin = await requireRole("ADMIN");
  await revokeSessions(admin, s(form, "userId"));
  refresh(s(form, "userId"));
}
