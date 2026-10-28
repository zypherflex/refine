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
  };
}
