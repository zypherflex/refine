import { afterEach, describe, expect, it } from "vitest";
import { integrationStatus } from "@/server/integrations";

describe("integration status", () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });

  it("never claims email or payments from a provider name alone", () => {
    process.env.EMAIL_PROVIDER = "smtp";
    delete process.env.SMTP_URL;
    process.env.PAYMENT_PROVIDER = "stripe";
    const s = integrationStatus();
    expect(s.email).toEqual({ configured: true, available: false });
    expect(s.payments).toEqual({ configured: true, available: false });
  });

  it("enables SMTP email only with a server URL and sender address", () => {
    process.env.EMAIL_PROVIDER = "smtp";
    process.env.SMTP_URL = "smtp://localhost:2525";
    process.env.EMAIL_FROM = "alerts@example.com";
    expect(integrationStatus().email.available).toBe(true);
    process.env.EMAIL_PROVIDER = "sendgrid";
    expect(integrationStatus().email.available).toBe(false);
  });

  it("reports the language model only when a key is present", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(integrationStatus().languageModel).toBe(false);
    process.env.ANTHROPIC_API_KEY = "test";
    expect(integrationStatus().languageModel).toBe(true);
  });

  it("treats S3 as available only with full credentials", () => {
    process.env.STORAGE_DRIVER = "s3";
    delete process.env.S3_BUCKET;
    expect(integrationStatus().storage.available).toBe(false);
    Object.assign(process.env, { S3_BUCKET: "b", S3_REGION: "eu-west-1", S3_ACCESS_KEY_ID: "k", S3_SECRET_ACCESS_KEY: "s" });
    expect(integrationStatus().storage.available).toBe(true);
    process.env.STORAGE_DRIVER = "gcs";
    expect(integrationStatus().storage.available).toBe(false);
  });
});
