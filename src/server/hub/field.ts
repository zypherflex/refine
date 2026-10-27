import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { can, type Actor } from "@/lib/permissions";
import { isState } from "@/lib/hub/catalog";
import { startOfDay } from "@/lib/hub/rules";
import { audit } from "../audit";
import { reviewBusiness } from "./business";

/**
 * Field verification programme: agents visit businesses that asked for verification and record what they saw.
 * An editor accepts the visit (which verifies the business) or rejects it. Agents are paid per accepted visit;
 * RefineryLens records the amount and when it was paid, but pays outside the app.
 */
export const PROGRAMME_STATES = ["LA", "OG"] as const;
export const payoutNgn = () => Math.max(0, Number(process.env.FIELD_PAYOUT_NGN ?? 5000) || 0);

export const agentInput = z.object({ email: z.string().trim().toLowerCase().email(), areas: z.array(z.string().refine(isState, "Unknown state")).min(1, "Choose at least one state"), enabled: z.boolean() });

export async function setFieldAgent(actor: Actor, raw: z.input<typeof agentInput>) {
  if (!can.reviewHub(actor)) throw new ForbiddenError();
  const input = agentInput.parse(raw);
  const u = await db.user.findUnique({ where: { email: input.email } });
  if (!u) throw new NotFoundError("No account with that email. Ask the agent to register first.");
  await db.user.update({ where: { id: u.id }, data: { fieldAgent: input.enabled, agentAreas: input.enabled ? input.areas : [] } });
  await audit(actor.id, input.enabled ? "hub.agent.add" : "hub.agent.remove", "User", u.id, { areas: input.areas });
}

export async function listAgents() {
  return db.user.findMany({ where: { fieldAgent: true }, select: { id: true, name: true, email: true, agentAreas: true, hubBusiness: { select: { id: true } } }, orderBy: { name: "asc" } });
}

export async function assignVisit(actor: Actor, businessId: string, agentId: string) {
  if (!can.reviewHub(actor)) throw new ForbiddenError();
  const [b, agent] = await Promise.all([db.hubBusiness.findUnique({ where: { id: businessId } }), db.user.findUnique({ where: { id: agentId } })]);
  if (!b) throw new NotFoundError("Business not found");
  if (!agent?.fieldAgent) throw new AppError("Choose a field agent.");
  if (b.ownerId === agent.id) throw new AppError("An agent cannot visit their own business.");
  if (b.verification !== "PENDING") throw new AppError("Only businesses waiting for verification get a visit.");
  if (!agent.agentAreas.includes(b.state)) throw new AppError("This agent does not cover that state.");
  const open = await db.fieldVisit.count({ where: { businessId, status: { in: ["ASSIGNED", "SUBMITTED"] } } });
  if (open) throw new AppError("This business already has an open visit.");
  const v = await db.fieldVisit.create({ data: { businessId, agentId, assignedById: actor.id } });
  await audit(actor.id, "hub.visit.assign", "FieldVisit", v.id, { businessId, agentId });
  return v;
}

export const visitReport = z.object({
  visitId: z.string().min(1),
  visitedOn: z.coerce.date(),
  cacSeen: z.boolean(),
  licenceSeen: z.boolean(),
  premisesSeen: z.boolean(),
  phoneAnswered: z.boolean(),
  productSeen: z.boolean(),
  notes: z.string().trim().min(10, "Describe what you saw in a sentence or two").max(2000),
});

export async function submitVisit(actor: Actor, raw: z.input<typeof visitReport>, now = new Date()) {
  const input = visitReport.parse(raw);
  const v = await db.fieldVisit.findUnique({ where: { id: input.visitId } });
  if (!v || v.agentId !== actor.id) throw new NotFoundError("Visit not found");
  if (v.status !== "ASSIGNED") throw new AppError("This visit has already been submitted.");
  if (startOfDay(input.visitedOn) > startOfDay(now)) throw new AppError("Submit the visit after it happens.");
  const { visitId, ...data } = input;
  const u = await db.fieldVisit.update({ where: { id: visitId }, data: { ...data, visitedOn: startOfDay(input.visitedOn), status: "SUBMITTED", submittedAt: now } });
  await audit(actor.id, "hub.visit.submit", "FieldVisit", v.id);
  return u;
}

/** Accepting a visit verifies the business and books the agent's payout. Rejecting sends the business back with a note. */
export async function decideVisit(actor: Actor, visitId: string, accept: boolean, note = "") {
  if (!can.reviewHub(actor)) throw new ForbiddenError();
  const v = await db.fieldVisit.findUnique({ where: { id: visitId } });
  if (!v) throw new NotFoundError("Visit not found");
  if (v.status !== "SUBMITTED") throw new AppError("Only submitted visits can be decided.");
  if (v.agentId === actor.id) throw new ForbiddenError("You cannot review your own visit.");
  if (accept && !(v.cacSeen && v.premisesSeen && v.phoneAnswered)) throw new AppError("The agent must have seen the CAC certificate and the premises, and reached the phone, before a visit can verify a business.");
  if (!accept && !note.trim()) throw new AppError("Say why, so the agent and business know what to fix.");
  await reviewBusiness(actor, { businessId: v.businessId, decision: accept ? "VERIFY" : "REJECT", note: accept ? note || "Verified after a field visit." : note });
  const u = await db.fieldVisit.update({ where: { id: v.id }, data: { status: accept ? "ACCEPTED" : "REJECTED", reviewedById: actor.id, reviewNote: note, payoutNgn: accept ? payoutNgn() : 0 } });
  await audit(actor.id, accept ? "hub.visit.accept" : "hub.visit.reject", "FieldVisit", v.id);
  return u;
}

export async function markPaid(actor: Actor, visitId: string, now = new Date()) {
  if (!can.manageUsers(actor)) throw new ForbiddenError();
  const { count } = await db.fieldVisit.updateMany({ where: { id: visitId, status: "ACCEPTED", paidAt: null }, data: { paidAt: now } });
  if (!count) throw new AppError("Only accepted, unpaid visits can be marked paid.");
  await audit(actor.id, "hub.visit.paid", "FieldVisit", visitId);
}

export async function myVisits(actor: Actor) {
  if (!(await db.user.findUnique({ where: { id: actor.id } }))?.fieldAgent) throw new ForbiddenError("You are not a field agent.");
  const visits = await db.fieldVisit.findMany({ where: { agentId: actor.id }, include: { business: true }, orderBy: { createdAt: "desc" } });
  const accepted = visits.filter((v) => v.status === "ACCEPTED");
  return {
    visits,
    earnings: { accepted: accepted.length, owed: accepted.filter((v) => !v.paidAt).reduce((s, v) => s + v.payoutNgn, 0), paid: accepted.filter((v) => v.paidAt).reduce((s, v) => s + v.payoutNgn, 0) },
  };
}

export async function programmeOverview(actor: Actor) {
  if (!can.reviewHub(actor)) throw new ForbiddenError();
  const [agents, submitted, open, accepted] = await Promise.all([
    listAgents(),
    db.fieldVisit.findMany({ where: { status: "SUBMITTED" }, include: { business: true, agent: { select: { name: true } } }, orderBy: { submittedAt: "asc" } }),
    db.fieldVisit.findMany({ where: { status: "ASSIGNED" }, include: { business: true, agent: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
    db.fieldVisit.findMany({ where: { status: "ACCEPTED" }, include: { business: true, agent: { select: { name: true } } }, orderBy: { updatedAt: "desc" }, take: 50 }),
  ]);
  return { agents, submitted, open, accepted };
}
