/** Licences, permits and certificates Nigerian energy businesses are commonly asked for. */
export const COMPLIANCE_KINDS = [
  { id: "CAC", label: "CAC certificate of incorporation", expires: false },
  { id: "TCC", label: "Tax clearance certificate (FIRS)", expires: true },
  { id: "NMDPRA", label: "NMDPRA licence or permit", expires: true },
  { id: "NCDMB", label: "NCDMB NOGICJQS registration", expires: true },
  { id: "FIRE", label: "Fire safety certificate", expires: true },
  { id: "INSURANCE", label: "Insurance policy", expires: true },
  { id: "PENCOM", label: "PenCom compliance certificate", expires: true },
  { id: "ITF", label: "ITF compliance certificate", expires: true },
  { id: "NSITF", label: "NSITF compliance certificate", expires: true },
  { id: "SON", label: "SON product certificate", expires: true },
  { id: "ENVIRONMENT", label: "State environmental permit", expires: true },
  { id: "OTHER", label: "Other", expires: true },
] as const;
export type ComplianceKind = (typeof COMPLIANCE_KINDS)[number]["id"];
export const complianceLabel = (id: string) => COMPLIANCE_KINDS.find((k) => k.id === id)?.label ?? id;

/** Reminder stages, in days before expiry. 0 means "expired today or earlier". */
export const REMINDER_STAGES = [60, 30, 7, 0] as const;
export const EXPIRING_DAYS = 60;

export type ComplianceStatus = "VALID" | "EXPIRING" | "EXPIRED" | "NO_EXPIRY";

export function complianceStatus(expiresOn: Date | null, now = new Date()): ComplianceStatus {
  if (!expiresOn) return "NO_EXPIRY";
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.round((expiresOn.getTime() - today) / 86_400_000);
  if (days < 0) return "EXPIRED";
  return days <= EXPIRING_DAYS ? "EXPIRING" : "VALID";
}

/** The reminder stage that applies today: the smallest stage the days-left count has reached, or null if none yet. */
export function dueStage(expiresOn: Date, now = new Date()): number | null {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.round((expiresOn.getTime() - today) / 86_400_000);
  const reached = REMINDER_STAGES.filter((s) => days <= s);
  return reached.length ? Math.min(...reached) : null;
}
