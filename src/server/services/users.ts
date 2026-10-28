import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, ForbiddenError } from "@/lib/errors";
import { can, type Actor } from "@/lib/permissions";
import type { Role } from "@prisma/client";
import { audit } from "../audit";

export const registerInput = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(10, "Use at least 10 characters.").max(200),
});

export async function registerUser(raw: z.input<typeof registerInput>) {
  const input = registerInput.parse(raw);
  const exists = await db.user.findUnique({ where: { email: input.email } });
  if (exists) throw new AppError("An account with that email already exists.");
  const user = await db.user.create({ data: { name: input.name, email: input.email, passwordHash: await bcrypt.hash(input.password, 12), role: "USER", plan: "FREE" } });
  await audit(user.id, "user.register", "User", user.id);
  return user;
}

const DUMMY_HASH = "$2b$12$mp6pEGlh6plQeKjUfAfxU.FOoW/Liht45pvCpz87EgraCB4.wIIja";

/** Constant-ish time check: a bcrypt comparison always runs, so response time does not reveal valid emails. */
export async function verifyCredentials(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return null;
  return user;
}

export async function changeRole(actor: Actor, userId: string, role: Role) {
  if (!can.manageUsers(actor)) throw new ForbiddenError();
  if (actor.id === userId) throw new AppError("You cannot change your own role.");
  await db.user.update({ where: { id: userId }, data: { role } });
  await audit(actor.id, "user.change_role", "User", userId, { role });
}

export async function changePassword(actor: Actor, current: string, next: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: actor.id } });
  if (!(await bcrypt.compare(current, user.passwordHash))) throw new AppError("Your current password is incorrect.");
  if (next.length < 10) throw new AppError("Use at least 10 characters.");
  await db.user.update({ where: { id: actor.id }, data: { passwordHash: await bcrypt.hash(next, 12) } });
  await db.session.deleteMany({ where: { userId: actor.id } });
  await audit(actor.id, "user.change_password", "User", actor.id);
}
