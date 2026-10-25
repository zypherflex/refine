"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/server/auth";
import { changeRole } from "@/server/services/users";
import { audit } from "@/server/audit";
import type { Plan, Role } from "@prisma/client";

export async function changeRoleAction(form: FormData) {
  const admin = await requireRole("ADMIN");
  const role = String(form.get("role")) as Role;
  if (!["USER", "ANALYST", "EDITOR", "ADMIN"].includes(role)) return;
  await changeRole(admin, String(form.get("userId")), role).catch(() => undefined);
  revalidatePath("/admin");
}

export async function changePlanAction(form: FormData) {
  const admin = await requireRole("ADMIN");
  const plan = String(form.get("plan")) as Plan;
  if (!["FREE", "PRO", "TEAM"].includes(plan)) return;
  const userId = String(form.get("userId"));
  await db.user.update({ where: { id: userId }, data: { plan } });
  await audit(admin.id, "user.change_plan", "User", userId, { plan });
  revalidatePath("/admin");
}
