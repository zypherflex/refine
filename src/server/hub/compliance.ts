import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { COMPLIANCE_KINDS, complianceLabel, dueStage } from "@/lib/hub/compliance";
import { startOfDay } from "@/lib/hub/rules";
import { storage } from "../storage";
import { audit } from "../audit";
import { requireBusiness } from "./business";

/**
 * Compliance vault: a business's licences, permits and certificates with expiry dates and an optional scanned copy.
 * Files are private to the business owner (nobody else, staff included, can download them). Reminders go out at 60,
 * 30 and 7 days before expiry and on expiry, once each.
 */
export const MAX_FILE_MB = 10;
export const MAX_RECORDS = 60;

const FILE_TYPES = [
  { ext: "pdf", mime: "application/pdf", magic: (b: Buffer) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  { ext: "png", mime: "image/png", magic: (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: "jpg", mime: "image/jpeg", magic: (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
] as const;

/** Checks the bytes, not the browser's claimed type. */
export function sniffScan(data: Buffer) {
  if (!data.length) return null;
  if (data.length > MAX_FILE_MB * 1024 * 1024) throw new AppError(`Files must be ${MAX_FILE_MB} MB or smaller.`);
  const t = FILE_TYPES.find((f) => f.magic(data));
  if (!t) throw new AppError("Upload a PDF, PNG or JPEG scan.");
  return t;
}

const kindIds = COMPLIANCE_KINDS.map((k) => k.id as string);
export const recordInput = z.object({
  kind: z.string().refine((k) => kindIds.includes(k), "Choose what kind of document this is"),
  title: z.string().trim().max(120).default(""),
  number: z.string().trim().max(80).default(""),
  issuer: z.string().trim().max(120).default(""),
  issuedOn: z.date().nullable().default(null),
  expiresOn: z.date().nullable().default(null),
  inVendorPack: z.boolean().default(true),
});

export type Upload = { name: string; data: Buffer } | null;

export async function addRecord(actor: Actor, raw: z.input<typeof recordInput>, file: Upload = null, now = new Date()) {
  const input = recordInput.parse(raw);
  const b = await requireBusiness(actor);
  if ((await db.complianceRecord.count({ where: { businessId: b.id } })) >= MAX_RECORDS) throw new AppError(`The vault holds up to ${MAX_RECORDS} records. Remove old ones first.`);
  if (input.issuedOn && startOfDay(input.issuedOn) > startOfDay(now)) throw new AppError("The issue date cannot be in the future.");
  if (input.issuedOn && input.expiresOn && input.expiresOn <= input.issuedOn) throw new AppError("The expiry date must be after the issue date.");
  if (!input.expiresOn && COMPLIANCE_KINDS.find((k) => k.id === input.kind)?.expires) throw new AppError("Add the expiry date so we can remind you before it runs out.");
  const fileData = file?.data.length ? await saveFile(b.id, file) : {};
  const r = await db.complianceRecord.create({
    data: {
      businessId: b.id, kind: input.kind, title: input.title || complianceLabel(input.kind), number: input.number, issuer: input.issuer,
      issuedOn: input.issuedOn ? startOfDay(input.issuedOn) : null, expiresOn: input.expiresOn ? startOfDay(input.expiresOn) : null, inVendorPack: input.inVendorPack, ...fileData,
    },
  });
  await audit(actor.id, "hub.compliance.add", "ComplianceRecord", r.id, { kind: input.kind, file: !!file?.data.length });
  return r;
}

async function saveFile(businessId: string, file: NonNullable<Upload>) {
  const t = sniffScan(file.data)!;
  const key = await storage().put(`compliance/${businessId.toLowerCase().replace(/[^a-z0-9]/g, "")}`, file.data, t.ext);
  return { storageKey: key, fileName: file.name.slice(0, 200), mimeType: t.mime, sizeBytes: file.data.length, sha256: createHash("sha256").update(file.data).digest("hex") };
}

async function ownRecord(actor: Actor, id: string) {
  const b = await requireBusiness(actor);
  const r = await db.complianceRecord.findFirst({ where: { id, businessId: b.id } });
  if (!r) throw new NotFoundError("Record not found");
  return r;
}

/** A renewal: new dates (and optionally a new scan) replace the old ones, and reminders start again. */
export const renewInput = z.object({ id: z.string().min(1), issuedOn: z.date().nullable().default(null), expiresOn: z.date(), number: z.string().trim().max(80).optional() });

export async function renewRecord(actor: Actor, raw: z.input<typeof renewInput>, file: Upload = null) {
  const input = renewInput.parse(raw);
  const r = await ownRecord(actor, input.id);
  if (r.expiresOn && input.expiresOn <= r.expiresOn) throw new AppError("The new expiry date must be later than the current one.");
  const fileData: Partial<Awaited<ReturnType<typeof saveFile>>> = file?.data.length ? await saveFile(r.businessId, file) : {};
  await db.complianceRecord.update({
    where: { id: r.id },
    data: { issuedOn: input.issuedOn ? startOfDay(input.issuedOn) : r.issuedOn, expiresOn: startOfDay(input.expiresOn), number: input.number ?? r.number, reminderStage: null, ...fileData },
  });
  if (fileData.storageKey && r.storageKey) await storage().remove(r.storageKey);
  await audit(actor.id, "hub.compliance.renew", "ComplianceRecord", r.id);
}

export async function setInVendorPack(actor: Actor, id: string, include: boolean) {
  const r = await ownRecord(actor, id);
  await db.complianceRecord.update({ where: { id: r.id }, data: { inVendorPack: include } });
}

export async function removeRecord(actor: Actor, id: string) {
  const r = await ownRecord(actor, id);
  await db.complianceRecord.delete({ where: { id: r.id } });
  if (r.storageKey) await storage().remove(r.storageKey);
  await audit(actor.id, "hub.compliance.remove", "ComplianceRecord", r.id);
}

export async function listRecords(actor: Actor) {
  const b = await db.hubBusiness.findUnique({ where: { ownerId: actor.id } });
  if (!b) return null;
  const records = await db.complianceRecord.findMany({ where: { businessId: b.id }, orderBy: [{ expiresOn: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }] });
  return { business: b, records };
}

/** The scanned file, for its owner only. */
export async function recordFile(actor: Actor, id: string) {
  const b = await db.hubBusiness.findUnique({ where: { ownerId: actor.id } });
  const r = b ? await db.complianceRecord.findFirst({ where: { id, businessId: b.id } }) : null;
  if (!r?.storageKey) return null;
  return { data: await storage().get(r.storageKey), mimeType: r.mimeType, fileName: r.fileName };
}

const STAGE_TEXT: Record<number, string> = { 60: "expires in about two months", 30: "expires in about a month", 7: "expires within a week", 0: "has expired" };

/** Sends due reminders as in-app alerts (email copies follow the user's alert settings). Safe to run every few minutes. */
export async function sendComplianceReminders(now = new Date()) {
  const horizon = new Date(startOfDay(now).getTime() + 61 * 86_400_000);
  const rows = await db.complianceRecord.findMany({ where: { expiresOn: { not: null, lte: horizon }, OR: [{ reminderStage: null }, { reminderStage: { gt: 0 } }] }, include: { business: { select: { ownerId: true, verification: true } } }, take: 2000 });
  let sent = 0;
  for (const r of rows) {
    if (r.business.verification === "SUSPENDED") continue;
    const stage = dueStage(r.expiresOn!, now);
    if (stage == null || (r.reminderStage != null && stage >= r.reminderStage)) continue;
    // Claim the stage first so two workers never send the same reminder.
    const { count } = await db.complianceRecord.updateMany({ where: { id: r.id, reminderStage: r.reminderStage }, data: { reminderStage: stage } });
    if (!count) continue;
    const day = r.expiresOn!.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    await db.alert.create({
      data: {
        userId: r.business.ownerId, kind: "COMPLIANCE", title: `${r.title} ${STAGE_TEXT[stage]}`,
        body: `${r.title}${r.number ? ` (${r.number})` : ""} ${stage === 0 ? "expired on" : "expires on"} ${day}. Renew it with ${r.issuer || "the issuer"} and update the vault so buyers see it as current.`,
        link: "/hub/compliance", dedupeKey: `compliance-${r.id}-${r.expiresOn!.toISOString().slice(0, 10)}-${stage}`,
      },
    });
    sent++;
  }
  return { sent };
}
