import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Opportunity } from "@/lib/opportunities/catalog";
import { scaleLabel, segmentLabel } from "@/lib/opportunities/catalog";
import { CALCULATORS, sensitivity, type Inputs } from "@/lib/opportunities/calculators";
import { SOURCES } from "@/lib/opportunities/sources";
import { fmtDate, fmtDateTime } from "@/lib/format";

// The standard PDF fonts only cover Windows-1252, so typographic symbols are spelled out.
const SUBS: [RegExp, string][] = [
  [/[“”]/g, '"'], [/[‘’]/g, "'"], [/[–—]/g, "-"], [/−/g, "-"], [/×/g, "x"], [/÷/g, "/"], [/Σ/g, "sum of"],
  [/[⌊⌋]/g, ""], [/≤/g, "<="], [/≥/g, ">="], [/→/g, "->"], [/…/g, "..."], [/ /g, " "], [/₦/g, "NGN "],
];
export function pdfSafe(text: string): string {
  let t = text;
  for (const [re, sub] of SUBS) t = t.replace(re, sub);
  return t.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

const GREEN = rgb(0.03, 0.4, 0.22);
const INK = rgb(0.07, 0.12, 0.09);
const MUTED = rgb(0.35, 0.4, 0.37);
const WARN = rgb(0.6, 0.35, 0.02);

type Scenario = { name: string; inputs: unknown; createdAt: Date } | null;

export async function buildBrief(o: Opportunity, opts: { userName: string; checked: string[]; scenario: Scenario; now?: Date }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(pdfSafe(`${o.title} - RefineryLens brief`));
  pdf.setAuthor("RefineryLens");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595, H = 842, M = 48, maxW = W - 2 * M;
  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;

  const newPage = () => {
    page = pdf.addPage([W, H]);
    y = H - M;
  };
  const wrap = (text: string, f: PDFFont, size: number, width = maxW) => {
    const words = pdfSafe(text).split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line);
        line = w;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  };
  const text = (t: string, o2: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb>; indent?: number; gap?: number } = {}) => {
    const size = o2.size ?? 10, f = o2.f ?? font, indent = o2.indent ?? 0;
    for (const l of wrap(t, f, size, maxW - indent)) {
      if (y < M + size) newPage();
      page.drawText(l, { x: M + indent, y: y - size, size, font: f, color: o2.color ?? INK });
      y -= size * 1.35;
    }
    y -= o2.gap ?? 4;
  };
  const heading = (t: string) => {
    if (y < M + 60) newPage();
    y -= 6;
    text(t, { size: 12, f: bold, color: GREEN, gap: 2 });
  };
  const bullet = (t: string, mark = "-") => text(`${mark}  ${t}`, { indent: 8, gap: 2 });

  page.drawRectangle({ x: 0, y: H - 6, width: W / 3, height: 6, color: GREEN });
  page.drawRectangle({ x: (2 * W) / 3, y: H - 6, width: W / 3, height: 6, color: GREEN });
  text("REFINERYLENS · OPPORTUNITY BRIEF", { size: 8, f: bold, color: GREEN });
  text(o.title, { size: 18, f: bold, gap: 2 });
  text(`${segmentLabel(o.segment)} · suits ${o.scales.map(scaleLabel).join(", ").toLowerCase()} businesses`, { size: 9, color: MUTED });
  text(`Prepared for ${opts.userName} on ${fmtDateTime(opts.now ?? new Date())}`, { size: 9, color: MUTED, gap: 8 });
  text(
    "Independent analysis by RefineryLens. This is not an offer, tender, distributorship or partnership programme of Dangote or any Dangote company, and RefineryLens is not affiliated with them. Not financial or investment advice. Confirm all terms with suppliers and regulators.",
    { size: 8.5, color: WARN, gap: 8 },
  );

  text(o.pitch, { size: 11, gap: 4 });
  heading("How the business works");
  text(o.howItWorks);

  heading("What it builds on (company statements, not verified by RefineryLens)");
  for (const a of o.anchors) {
    const s = SOURCES[a.source];
    bullet(a.text);
    text(`Source: ${s.publisher}, ${s.title} (${s.url}), retrieved ${fmtDate(s.retrievedAt)}`, { size: 8, color: MUTED, indent: 18 });
  }
  if (o.context.length) {
    heading("What has been reported");
    for (const c of o.context) {
      const s = SOURCES[c.source];
      const tag = c.stance === "tailwind" ? "Helps the case" : c.stance === "headwind" ? "Works against it" : "Context";
      bullet(`[${tag}] ${c.text}`);
      text(`Source: ${s.publisher}, ${s.title}${s.publishedAt ? `, published ${fmtDate(s.publishedAt)}` : ""} (${s.url})`, { size: 8, color: MUTED, indent: 18 });
    }
  }

  heading(`Readiness: ${o.validate.filter((q) => opts.checked.includes(q)).length} of ${o.validate.length} questions answered`);
  for (const q of o.validate) bullet(q, opts.checked.includes(q) ? "[x]" : "[  ]");
  heading("Risks");
  for (const r of o.risks) bullet(r);
  heading("Licences and registrations to check");
  for (const p of o.permits) bullet(p);

  const sc = opts.scenario;
  const calc = o.calculator ? CALCULATORS[o.calculator.id] : null;
  if (sc && calc && o.calculator) {
    const unit = o.calculator.unit;
    const inputs = (sc.inputs ?? {}) as Inputs;
    heading(`Your scenario: ${sc.name}`);
    text(`${calc.name}. Every input below is your own assumption, saved ${fmtDateTime(sc.createdAt)}. Results are recalculated now.`, { size: 9, color: MUTED });
    for (const f of calc.fields({ unit })) {
      const v = inputs[f.key];
      bullet(`${f.label}: ${v === null || v === undefined ? "not entered" : `${v.toLocaleString("en-GB")} ${f.unit}`}`);
    }
    const r = calc.compute(inputs, { unit });
    if (r.ok) {
      y -= 4;
      text(`${r.headline.label}: ${r.headline.value.toLocaleString("en-GB", { maximumFractionDigits: 2 })} ${r.headline.unit}`, { size: 12, f: bold });
      for (const l of r.lines) {
        bullet(`${l.label}: ${l.value.toLocaleString("en-GB", { maximumFractionDigits: 2 })} ${l.unit}`);
        text(`= ${l.formula}`, { size: 8, color: MUTED, indent: 18 });
      }
      for (const n of r.notes) text(n, { size: 8.5, color: MUTED });
      const sens = sensitivity(o.calculator.id, inputs, { unit });
      if (sens?.rows.length) {
        text(`What if one input is 10% lower / higher (${sens.base.unit}):`, { f: bold, size: 9.5 });
        for (const row of sens.rows) bullet(`${row.label}: ${row.low === null ? "n/a" : row.low.toLocaleString("en-GB", { maximumFractionDigits: 0 })} / ${row.high === null ? "n/a" : row.high.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`);
      }
    } else {
      text(`Not calculated: ${r.reason}`);
    }
  }

  const pages = pdf.getPages();
  pages.forEach((p, i) => p.drawText(pdfSafe(`RefineryLens · independent analysis · page ${i + 1} of ${pages.length}`), { x: M, y: 24, size: 7.5, font, color: MUTED }));
  return pdf.save();
}
