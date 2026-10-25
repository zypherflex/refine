/** File validation for uploads. Content is sniffed rather than trusting the browser-supplied type. */
export const ALLOWED = {
  pdf: { mime: "application/pdf", ext: "pdf" },
  txt: { mime: "text/plain", ext: "txt" },
  csv: { mime: "text/csv", ext: "csv" },
} as const;

export type AllowedKind = keyof typeof ALLOWED;

export function maxUploadBytes(): number {
  const mb = Number(process.env.MAX_UPLOAD_MB ?? 15);
  return (Number.isFinite(mb) && mb > 0 ? mb : 15) * 1024 * 1024;
}

export function sniffFile(name: string, data: Buffer): { ok: true; kind: AllowedKind } | { ok: false; reason: string } {
  if (data.length === 0) return { ok: false, reason: "The file is empty." };
  if (data.length > maxUploadBytes()) return { ok: false, reason: `The file is larger than the ${maxUploadBytes() / 1024 / 1024} MB limit.` };
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (data.subarray(0, 5).toString("latin1") === "%PDF-") {
    if (ext !== "pdf") return { ok: false, reason: "The file contents are a PDF but the name does not end in .pdf." };
    return { ok: true, kind: "pdf" };
  }
  if (ext === "txt" || ext === "csv") {
    // Reject binary content masquerading as text.
    const sample = data.subarray(0, 4096);
    if (sample.includes(0)) return { ok: false, reason: "The file appears to be binary, not text." };
    return { ok: true, kind: ext };
  }
  return { ok: false, reason: "Only PDF, TXT and CSV files are accepted." };
}
