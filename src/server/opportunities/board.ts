import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { ASSETS, opportunityBySlug, SCALES, SEGMENTS } from "@/lib/opportunities/catalog";
import { CALCULATORS, isCalculatorId } from "@/lib/opportunities/calculators";
import { audit } from "../audit";

/** A user's opportunity board and saved scenarios are private, like a thesis: nobody else can read them, staff included. */

export const boardInput = z.object({
  slug: z.string().min(1).max(80),
  stage: z.enum(["EXPLORING", "VALIDATING", "PURSUING", "PARKED"]).default("EXPLORING"),
  notes: z.string().trim().max(4000).default(""),
  nextStep: z.string().trim().max(300).default(""),
});

export async function listBoard(actor: Actor) {
  return db.opportunityBoardItem.findMany({ where: { userId: actor.id }, orderBy: { updatedAt: "desc" } });
}

export async function boardItem(actor: Actor, slug: string) {
  return db.opportunityBoardItem.findUnique({ where: { userId_opportunitySlug: { userId: actor.id, opportunitySlug: slug } } });
}

export async function saveBoardItem(actor: Actor, raw: z.input<typeof boardInput>) {
  const input = boardInput.parse(raw);
  if (!opportunityBySlug(input.slug)) throw new NotFoundError("Opportunity not found");
  const data = { stage: input.stage, notes: input.notes, nextStep: input.nextStep };
  return db.opportunityBoardItem.upsert({
    where: { userId_opportunitySlug: { userId: actor.id, opportunitySlug: input.slug } },
    update: data,
    create: { userId: actor.id, opportunitySlug: input.slug, ...data },
  });
}

export async function removeBoardItem(actor: Actor, slug: string) {
  await db.opportunityBoardItem.deleteMany({ where: { userId: actor.id, opportunitySlug: slug } });
}

export const scenarioInput = z.object({
  calculatorId: z.string().refine(isCalculatorId, "Unknown sizing tool"),
  opportunitySlug: z.string().max(80).nullable().optional(),
  name: z.string().trim().min(2).max(120),
  inputs: z.record(z.string(), z.number().finite().nullable()),
});

export async function saveScenario(actor: Actor, raw: z.input<typeof scenarioInput>) {
  const input = scenarioInput.parse(raw);
  const calc = CALCULATORS[input.calculatorId as keyof typeof CALCULATORS];
  const opp = input.opportunitySlug ? opportunityBySlug(input.opportunitySlug) : null;
  if (input.opportunitySlug && !opp) throw new NotFoundError("Opportunity not found");
  const unit = opp?.calculator?.id === calc.id ? opp.calculator.unit : undefined;
  // Keep only the tool's own fields so a saved scenario can always be recalculated.
  const keys = new Set(calc.fields({ unit }).map((f) => f.key));
  const inputs = Object.fromEntries(Object.entries(input.inputs).filter(([k]) => keys.has(k)));
  if (!Object.keys(inputs).length) throw new AppError("Enter at least one value before saving.");
  const count = await db.opportunityScenario.count({ where: { userId: actor.id } });
  if (count >= 200) throw new AppError("You have 200 saved scenarios. Delete some before saving more.");
  const s = await db.opportunityScenario.create({
    data: { userId: actor.id, calculatorId: calc.id, opportunitySlug: opp?.slug ?? null, name: input.name, inputs: inputs as Prisma.InputJsonObject },
  });
  await audit(actor.id, "scenario.create", "OpportunityScenario", s.id, { calculatorId: calc.id });
  return s;
}

export async function listScenarios(actor: Actor, filter: { calculatorId?: string; opportunitySlug?: string } = {}) {
  return db.opportunityScenario.findMany({
    where: { userId: actor.id, ...(filter.calculatorId ? { calculatorId: filter.calculatorId } : {}), ...(filter.opportunitySlug ? { opportunitySlug: filter.opportunitySlug } : {}) },
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteScenario(actor: Actor, id: string) {
  const { count } = await db.opportunityScenario.deleteMany({ where: { id, userId: actor.id } });
  if (!count) throw new NotFoundError("Scenario not found");
}

/** Ticks or unticks one readiness question. Only the opportunity's own questions can be ticked. */
export async function setReadiness(actor: Actor, slug: string, question: string, done: boolean) {
  const opp = opportunityBySlug(slug);
  if (!opp || !opp.validate.includes(question)) throw new NotFoundError("Question not found");
  const item = await boardItem(actor, slug);
  const current = new Set(item?.checked ?? []);
  if (done) current.add(question);
  else current.delete(question);
  const checked = opp.validate.filter((q) => current.has(q));
  return db.opportunityBoardItem.upsert({
    where: { userId_opportunitySlug: { userId: actor.id, opportunitySlug: slug } },
    update: { checked },
    create: { userId: actor.id, opportunitySlug: slug, checked },
  });
}

/** Ticked questions that still exist in the catalogue, and the share of the list they cover. */
export function readiness(slug: string, checked: string[]) {
  const opp = opportunityBySlug(slug);
  const total = opp?.validate.length ?? 0;
  const done = opp ? opp.validate.filter((q) => checked.includes(q)).length : 0;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

export const profileInput = z.object({
  scale: z.enum(SCALES.map((s) => s.id) as [string, ...string[]]),
  segments: z.array(z.enum(SEGMENTS.map((s) => s.id) as [string, ...string[]])).max(SEGMENTS.length).default([]),
  assets: z.array(z.enum(ASSETS.map((a) => a.id) as [string, ...string[]])).max(ASSETS.length).default([]),
});

export async function getProfile(actor: Actor) {
  return db.businessProfile.findUnique({ where: { userId: actor.id } });
}

export async function saveProfile(actor: Actor, raw: z.input<typeof profileInput>) {
  const input = profileInput.parse(raw);
  const data = { scale: input.scale, segments: [...new Set(input.segments)], assets: [...new Set(input.assets)] };
  return db.businessProfile.upsert({ where: { userId: actor.id }, update: data, create: { userId: actor.id, ...data } });
}
