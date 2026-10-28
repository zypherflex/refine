export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "Not stated";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "Not stated";
  const date = typeof d === "string" ? new Date(d) : d;
  return (
    date.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }) + " UTC"
  );
}

export function fmtNumber(n: number, digits = 1): string {
  return n.toLocaleString("en-GB", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

/** Formats a value with its currency and scale, e.g. "NGN 1,240.5 bn". */
export function fmtMoney(value: number, currency: string | null | undefined, scale: string): string {
  const s = scale === "billions" ? " bn" : scale === "millions" ? " m" : scale === "thousands" ? " k" : "";
  return `${currency ? currency + " " : ""}${fmtNumber(value)}${s}`;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
