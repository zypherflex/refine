import nodemailer from "nodemailer";
import { integrationStatus } from "./integrations";

export type EmailMessage = { to: string; subject: string; text: string; html: string };
export type Mailer = { send(msg: EmailMessage): Promise<void> };

let override: Mailer | null = null;
let cached: Mailer | null = null;

/** Tests replace the transport so no network is needed. */
export function setMailerForTests(m: Mailer | null) {
  override = m;
}

/** Returns a mailer only when an email provider is configured and supported; otherwise null (in-app alerts only). */
export function getMailer(): Mailer | null {
  if (override) return override;
  if (!integrationStatus().email.available) return null;
  if (!cached) {
    const transport = nodemailer.createTransport(process.env.SMTP_URL!);
    const from = process.env.EMAIL_FROM!;
    cached = {
      async send(msg) {
        await transport.sendMail({ from, ...msg });
      },
    };
  }
  return cached;
}
