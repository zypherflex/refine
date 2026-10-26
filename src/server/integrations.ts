import { PROVIDERS, type ProviderId } from "./opendata/catalog";

/**
 * Which external services are actually usable in this installation. A provider only counts as available when it is
 * configured AND this release ships an adapter for it, so the UI never claims delivery that cannot happen.
 */
const SHIPPED_EMAIL_ADAPTERS = ["smtp"];
const SHIPPED_PAYMENT_ADAPTERS: string[] = [];
const SHIPPED_STORAGE_DRIVERS = ["local", "s3"];

function s3Configured() {
  return Boolean(process.env.S3_BUCKET && process.env.S3_REGION && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
}

/**
 * Open-data feeds. All shipped feeds are on unless OPEN_DATA_FEEDS lists a subset (or "none"); a feed that needs a key
 * is only available once its key is set.
 */
export function openDataStatus(): Record<ProviderId, { enabled: boolean; available: boolean; reason: string }> {
  const raw = (process.env.OPEN_DATA_FEEDS ?? "").trim().toLowerCase();
  const listed = raw ? raw.split(/[\s,]+/).filter(Boolean) : null;
  const out = {} as Record<ProviderId, { enabled: boolean; available: boolean; reason: string }>;
  for (const p of Object.values(PROVIDERS)) {
    const enabled = listed ? listed.includes(p.id) : true;
    const keyed = !p.keyEnv || Boolean(process.env[p.keyEnv]);
    out[p.id] = { enabled, available: enabled && keyed, reason: !enabled ? "Turned off in OPEN_DATA_FEEDS" : !keyed ? `Needs ${p.keyEnv}` : "" };
  }
  return out;
}

export function integrationStatus() {
  const email = (process.env.EMAIL_PROVIDER ?? "").toLowerCase();
  const payment = (process.env.PAYMENT_PROVIDER ?? "").toLowerCase();
  const storage = (process.env.STORAGE_DRIVER ?? "local").toLowerCase();
  const emailCredentials = email === "smtp" ? Boolean(process.env.SMTP_URL && process.env.EMAIL_FROM) : false;
  return {
    database: true,
    storage: { driver: storage, available: SHIPPED_STORAGE_DRIVERS.includes(storage) && (storage !== "s3" || s3Configured()) },
    languageModel: Boolean(process.env.ANTHROPIC_API_KEY),
    email: { configured: Boolean(email), available: SHIPPED_EMAIL_ADAPTERS.includes(email) && emailCredentials },
    payments: { configured: Boolean(payment), available: SHIPPED_PAYMENT_ADAPTERS.includes(payment) },
    openData: openDataStatus(),
  };
}
