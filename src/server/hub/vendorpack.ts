import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { db } from "@/lib/db";
import type { Actor } from "@/lib/permissions";
import { productLabel, roleLabel, stateName } from "@/lib/hub/catalog";
import { complianceLabel, complianceStatus } from "@/lib/hub/compliance";
import { activePlan, displayName } from "@/lib/hub/rules";
import { pdfSafe } from "../opportunities/brief";
import { requireBusiness } from "./business";
import { tradeRecord } from "./finance";

const NAVY = rgb(0.043, 0.082, 0.188);
const GREEN = rgb(0.031, 0.486, 0.278);
const MUTED = rgb(0.35, 0.38, 0.45);
const AMBER = rgb(0.718, 0.475, 0.122);
const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const STATUS_TEXT = { VALID: "Current", EXPIRING: "Expires within 60 days", EXPIRED: "EXPIRED", NO_EXPIRY: "No expiry" } as const;

/**
 * A vendor pack for buyers' and operators' supplier checks (for example NCDMB-style vendor registration): profile,
 * verification, compliance records and the confirmed trade record. Files themselves are never included: the pack lists
 * them so a buyer can ask for copies. Everything is labelled as stated by the business unless RefineryLens checked it.
 */
export async function buildVendorPack(actor: Actor, now = new Date()): Promise<{ bytes: Uint8Array; fileName: string }> {
  const b = await requireBusiness(actor);
  const [records, record] = await Promise.all([
    db.complianceRecord.findMany({ where: { businessId: b.id, inVendorPack: true }, orderBy: [{ kind: "asc" }, { expiresOn: "asc" }] }),
    tradeRecord(b.id, now),
  ]);

  const pdf = await PDFDocument.create();
  pdf.setTitle(pdfSafe(`${b.name} - vendor pack`));
  pdf.setAuthor("RefineryLens");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595, H = 842, M = 48, maxW = W - 2 * M;
  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;
  const newPage = () => { page = pdf.addPage([W, H]); y = H - M; };
  const wrap = (t: string, f: PDFFont, size: number, width: number) => {
    const lines: string[] = [];
    let line = "";
    for (const w of pdfSafe(t).split(/\s+/)) {
      const next = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(next, size) > width && line) { lines.push(line); line = w; } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  };
  const text = (t: string, o: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb>; indent?: number; gap?: number } = {}) => {
    const size = o.size ?? 10, f = o.f ?? font, indent = o.indent ?? 0;
    for (const l of wrap(t, f, size, maxW - indent)) {
      if (y < M + size) newPage();
      page.drawText(l, { x: M + indent, y: y - size, size, font: f, color: o.color ?? NAVY });
      y -= size * 1.35;
    }
    y -= o.gap ?? 4;
  };
  const heading = (t: string) => { if (y < M + 60) newPage(); y -= 6; text(t, { size: 12, f: bold, color: GREEN, gap: 2 }); };
  const row = (label: string, value: string) => text(`${label}: ${value}`, { indent: 8, gap: 1 });

  page.drawRectangle({ x: 0, y: H - 6, width: W / 3, height: 6, color: GREEN });
  page.drawRectangle({ x: (2 * W) / 3, y: H - 6, width: W / 3, height: 6, color: GREEN });
  text("REFINERYLENS · VENDOR PACK", { size: 8, f: bold, color: GREEN });
  text(displayName(b), { size: 18, f: bold, gap: 2 });
  text(`Prepared ${day(now)} from records on RefineryLens${b.isSample ? " · SAMPLE BUSINESS (invented demo data)" : ""}`, { size: 9, color: MUTED, gap: 8 });

  heading("Business");
  row("Roles", b.roles.map(roleLabel).join(", ") || "-");
  row("Products", b.products.map(productLabel).join(", ") || "-");
  row("Location", `${b.town ? `${b.town}, ` : ""}${stateName(b.state)}`);
  row("CAC number (stated)", b.cacNumber || "-");
  row("Licence numbers (stated)", b.licenceNumbers || "-");
  row("Phone", b.phone);
  if (activePlan(b, now) === "VERIFIED_BUSINESS") row("Plan", "Verified Business member");

  heading("Verification by RefineryLens");
  if (b.verification === "VERIFIED" && b.verifiedAt) text(`Verified on ${day(b.verifiedAt)}: CAC certificate, licences and phone checked by a RefineryLens reviewer${b.verificationNote ? `. Note: ${b.verificationNote}` : "."}`, { indent: 8 });
  else text(`Not verified (status: ${b.verification.toLowerCase()}). Treat everything below as stated by the business.`, { indent: 8, color: AMBER });

  heading("Licences, permits and certificates");
  if (!records.length) text("None listed.", { indent: 8, color: MUTED });
  for (const r of records) {
    const status = complianceStatus(r.expiresOn, now);
    text(`${r.title}${r.title !== complianceLabel(r.kind) ? ` (${complianceLabel(r.kind)})` : ""}`, { f: bold, indent: 8, gap: 0 });
    text([r.number && `No. ${r.number}`, r.issuer && `issued by ${r.issuer}`, r.issuedOn && `on ${day(r.issuedOn)}`, r.expiresOn && `expires ${day(r.expiresOn)}`].filter(Boolean).join(", ") || "No details given", { indent: 16, gap: 0, size: 9 });
    text(`${STATUS_TEXT[status]} · ${r.storageKey ? "copy held in the vault, available from the business on request" : "no copy uploaded"}`, { indent: 16, size: 9, color: status === "EXPIRED" || status === "EXPIRING" ? AMBER : MUTED, gap: 4 });
  }

  heading("Confirmed trade record, last 12 months");
  const jobs = record.months.reduce((s, m) => s + m.jobs, 0);
  const supply = record.months.reduce((s, m) => s + m.supplyDeliveries, 0);
  row("Delivery jobs confirmed by both sides", String(jobs));
  row("Supply deliveries confirmed by both sides", String(supply));
  row("Different trading partners", String(record.counterparties));
  const r = record.reliability;
  row("Reliability score", r.score == null ? `not yet shown (${r.confirmed} of 5 confirmed trades)` : `${r.score} / 100 from ${r.confirmed} confirmed trades`);

  y -= 8;
  text("How to read this pack: licence and certificate details are entered by the business and are not checked by RefineryLens unless the verification section says so. Ask the business for copies and check them with the issuer. Trade records count only deliveries both sides confirmed on RefineryLens; they are not audited. This pack is not a credit rating, a guarantee or a recommendation. RefineryLens is independent and not affiliated with Dangote or any refiner.", { size: 8, color: MUTED });

  const slug = b.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "business";
  return { bytes: await pdf.save(), fileName: `refinerylens-vendor-pack-${slug}.pdf` };
}
