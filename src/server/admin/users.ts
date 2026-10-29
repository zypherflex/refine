import type { Plan, Prisma, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { audit } from "../audit";
import { changeRole } from "../services/users";
import { PAGE_SIZE, requireAdmin } from "./guard";

export type UserFilter = { q?: string; role?: string; plan?: string; audience?: string; state?: string; blocked?: string; sort?: string; page: number };

export async function searchUsers(actor: Actor, f: UserFilter) {
  requireAdmin(actor);
  const where: Prisma.UserWhereInput = {};
  if (f.q?.trim()) where.OR = [{ name: { contains: f.q.trim(), mode: "insensitive" } }, { email: { contains: f.q.trim(), mode: "insensitive" } }, { phone: { contains: f.q.trim() } }];
  if (f.role && ["USER", "ANALYST", "EDITOR", "ADMIN"].includes(f.role)) where.role = f.role as Role;
  if (f.plan && ["FREE", "PRO", "TEAM"].includes(f.plan)) where.plan = f.plan as Plan;
  if (f.audience === "PERSONAL" || f.audience === "BUSINESS") where.audience = f.audience;
  if (f.state) where.homeState = f.state;
  if (f.blocked === "yes") where.reportingBlocked = true;
  const [total, rows] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: f.sort === "name" ? { name: "asc" } : f.sort === "old" ? { createdAt: "asc" } : { createdAt: "desc" },
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, name: true, email: true, role: true, plan: true, audience: true, homeState: true, reportingBlocked: true, createdAt: true,
        hubBusiness: { select: { id: true, name: true, verification: true } },
        _count: { select: { gasOrders: true, outletReports: true, sessions: true } },
      },
    }),
  ]);
  return { total, rows };
}

/** One person: their settings, business, activity counts and recent actions by and about them. Never private files. */
export async function userDetail(actor: Actor, id: string) {
  requireAdmin(actor);
  const u = await db.user.findUnique({
    where: { id },
    include: {
      hubBusiness: { select: { id: true, name: true, verification: true, roles: true, state: true, planUntil: true } },
      _count: { select: { gasOrders: true, outletReports: true, outletsAdded: true, contentFlags: true, cylinders: true, payments: true, devices: true, theses: true, documents: true, hubThreads: true } },
    },
  });
  if (!u) throw new NotFoundError("User not found");
  const [sessions, orders, reports, byThem, aboutThem, payments] = await Promise.all([
    db.session.findMany({ where: { userId: id, expiresAt: { gt: new Date() } }, select: { id: true, createdAt: true, expiresAt: true }, orderBy: { createdAt: "desc" } }),
    db.gasOrder.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 10, include: { business: { select: { name: true } } } }),
    db.outletReport.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 10, include: { outlet: { select: { id: true, name: true } } } }),
    db.auditLog.findMany({ where: { actorId: id }, orderBy: { createdAt: "desc" }, take: 25 }),
    db.auditLog.findMany({ where: { entityType: "User", entityId: id }, orderBy: { createdAt: "desc" }, take: 25, include: { actor: { select: { name: true } } } }),
    db.payment.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const { passwordHash: _hidden, ...safe } = u;
  void _hidden;
  return { user: safe, sessions, orders, reports, byThem, aboutThem, payments };
}

export async function setUserRole(actor: Actor, userId: string, role: Role) {
  requireAdmin(actor);
  await changeRole(actor, userId, role);
}

export async function setUserPlan(actor: Actor, userId: string, plan: Plan) {
  requireAdmin(actor);
  if (!["FREE", "PRO", "TEAM"].includes(plan)) throw new AppError("Unknown plan.");
  await db.user.update({ where: { id: userId }, data: { plan } });
  await audit(actor.id, "user.change_plan", "User", userId, { plan });
}

export async function setUserAudience(actor: Actor, userId: string, audience: "PERSONAL" | "BUSINESS") {
  requireAdmin(actor);
  await db.user.update({ where: { id: userId }, data: { audience } });
  await audit(actor.id, "user.change_audience", "User", userId, { audience });
}

/** Signs the person out on every device, for a lost phone or a suspected break-in. */
export async function revokeSessions(actor: Actor, userId: string) {
  requireAdmin(actor);
  const { count } = await db.session.deleteMany({ where: { userId } });
  await db.deviceToken.deleteMany({ where: { userId } });
  await audit(actor.id, "user.sign_out_everywhere", "User", userId, { sessions: count });
  return count;
}
