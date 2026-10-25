/**
 * Text and figure extraction. Extraction produces candidates only: every figure becomes a DRAFT metric
 * that an editor must check against the cited page before publication.
 */

export async function extractPages(kind: "pdf" | "txt" | "csv", data: Buffer): Promise<string[]> {
  if (kind === "pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(data));
    const { text } = await extractText(pdf, { mergePages: false });
    return (Array.isArray(text) ? text : [text]).map((t) => t.replace(/\s+\n/g, "\n").trim());
  }
  const text = data.toString("utf8");
  // Plain text: treat form feeds as page breaks so page citations still work.
  return text.split("\f").map((p) => p.trim()).filter((p, i, all) => p.length > 0 || all.length === 1);
}

export type FigureCandidate = {
  key: string;
  label: string;
  value: number;
  currency: string | null;
  scale: string;
  page: number;
  excerpt: string;
};

const FIGURES: { key: string; label: string; pattern: RegExp }[] = [
  { key: "revenue", label: "Revenue", pattern: /\b(revenue|turnover)\b/i },
  { key: "operating_profit", label: "Operating profit", pattern: /\boperating (profit|income)\b/i },
  { key: "net_profit", label: "Net profit", pattern: /\b(net profit|profit after tax|net income)\b/i },
  { key: "operating_cash_flow", label: "Operating cash flow", pattern: /\b(net cash (generated )?from operating activities|operating cash flow)\b/i },
  { key: "capex", label: "Capital expenditure", pattern: /\b(capital expenditure|purchase of property, plant and equipment)\b/i },
  { key: "total_debt", label: "Total borrowings", pattern: /\b(total borrowings|total debt)\b/i },
  { key: "cash", label: "Cash and cash equivalents", pattern: /\bcash and cash equivalents\b/i },
  { key: "finance_costs", label: "Finance costs", pattern: /\bfinance costs?\b/i },
  { key: "fx_gain_loss", label: "Foreign-exchange gain/(loss)", pattern: /\b(foreign[- ]exchange|fx) (gain|loss)/i },
  { key: "dividends", label: "Dividends", pattern: /\bdividends? (paid|declared|proposed)\b/i },
];

const CURRENCY_RE = /(NGN|₦|N(?=\s?\d)|USD|US\$|\$|EUR|€|GBP|£)/;
const NUMBER_RE = /\(?-?\d{1,3}(?:,\d{3})*(?:\.\d+)?\)?|\(?-?\d+(?:\.\d+)?\)?/;
const SCALE_RE = /\b(billion|bn|million|mn|m|thousand|k)\b/i;

function normCurrency(c: string | undefined): string | null {
  if (!c) return null;
  if (c === "₦" || c === "N" || c === "NGN") return "NGN";
  if (c === "$" || c === "US$" || c === "USD") return "USD";
  if (c === "€" || c === "EUR") return "EUR";
  if (c === "£" || c === "GBP") return "GBP";
  return null;
}

function normScale(s: string | undefined): string {
  if (!s) return "units";
  const v = s.toLowerCase();
  if (v === "billion" || v === "bn") return "billions";
  if (v === "million" || v === "mn" || v === "m") return "millions";
  if (v === "thousand" || v === "k") return "thousands";
  return "units";
}

/** Finds lines like "Revenue: NGN 1,240.5 billion" and returns candidate figures with page references. */
export function extractFigures(pages: string[]): FigureCandidate[] {
  const out: FigureCandidate[] = [];
  const seen = new Set<string>();
  pages.forEach((text, i) => {
    for (const line of text.split(/\n/)) {
      for (const f of FIGURES) {
        if (!f.pattern.test(line) || seen.has(f.key)) continue;
        const after = line.slice(line.search(f.pattern));
        const cur = after.match(CURRENCY_RE);
        const numMatch = after.slice(cur ? (cur.index ?? 0) : 0).match(NUMBER_RE);
        if (!numMatch) continue;
        const raw = numMatch[0];
        const negative = raw.startsWith("(") || raw.startsWith("-");
        const value = Number(raw.replace(/[(),\s-]/g, "")) * (negative ? -1 : 1);
        if (!Number.isFinite(value)) continue;
        const rest = after.slice((numMatch.index ?? 0) + raw.length + (cur ? (cur.index ?? 0) : 0));
        const scale = rest.match(SCALE_RE);
        seen.add(f.key);
        out.push({
          key: f.key,
          label: f.label,
          value,
          currency: normCurrency(cur?.[1]),
          scale: normScale(scale?.[1]),
          page: i + 1,
          excerpt: line.trim().slice(0, 300),
        });
      }
    }
  });
  return out;
}

const INJECTION_RE = /(ignore (all |any )?(previous|prior|above) instructions|you are now|system prompt|disregard (the )?(rules|instructions)|act as)/i;

/** Flags text that looks like an attempt to instruct the assistant. Such text is still treated as data. */
export function looksLikeInstructions(text: string): boolean {
  return INJECTION_RE.test(text);
}
