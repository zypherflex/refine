import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createAlert } from "@/server/services/alerts";
import { sendDueAlertEmails, setEmailAlerts } from "@/server/services/alert-email";
import type { EmailMessage, Mailer } from "@/server/email";
import { resetDb, user } from "../helpers";

function fakeMailer(fail = false) {
  const sent: EmailMessage[] = [];
  const mailer: Mailer = { async send(m) { if (fail) throw new Error("smtp down"); sent.push(m); } };
  return { sent, mailer };
}

const alert = (userId: string, key: string, extra: Partial<Parameters<typeof createAlert>[0]> = {}) =>
  createAlert({ userId, kind: "NEW_ANNOUNCEMENT", title: `New: item ${key}`, body: "Body <b>text</b>", link: `/announcements/${key}`, dedupeKey: key, ...extra });

describe("alert email delivery", () => {
  beforeEach(resetDb);

  it("does nothing when no email provider is configured", async () => {
    const u = await user();
    await setEmailAlerts(u.id, true);
    await alert(u.id, "a1");
    expect(await sendDueAlertEmails(new Date(), null)).toEqual({ sent: 0, alerts: 0 });
    expect((await db.alert.findFirstOrThrow({ where: { userId: u.id } })).emailedAt).toBeNull();
  });

  it("emails only opted-in users, groups alerts, escapes HTML and never sends twice", async () => {
    const [optIn, optOut] = await Promise.all([user(), user()]);
    await setEmailAlerts(optIn.id, true);
    await alert(optIn.id, "a1");
    await alert(optIn.id, "a2", { kind: "CORRECTION", title: "Corrected: item a2" });
    await alert(optOut.id, "b1");
    const { sent, mailer } = fakeMailer();
    expect(await sendDueAlertEmails(new Date(), mailer)).toEqual({ sent: 1, alerts: 2 });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe(optIn.email);
    expect(sent[0]!.subject).toMatch(/2 RefineryLens alerts, including a correction/);
    expect(sent[0]!.html).toContain("&lt;b&gt;text&lt;/b&gt;");
    expect(sent[0]!.text).toContain("/announcements/a1");
    expect(await sendDueAlertEmails(new Date(), mailer)).toEqual({ sent: 0, alerts: 0 });
  });

  it("holds digest alerts until their digest time", async () => {
    const u = await user();
    await setEmailAlerts(u.id, true);
    const later = new Date(Date.now() + 3600_000);
    await alert(u.id, "d1", { visibleAt: later });
    const { sent, mailer } = fakeMailer();
    await sendDueAlertEmails(new Date(), mailer);
    expect(sent).toHaveLength(0);
    await sendDueAlertEmails(new Date(later.getTime() + 1000), mailer);
    expect(sent).toHaveLength(1);
  });

  it("does not email the backlog on opt-in, and retries after a failed send", async () => {
    const u = await user();
    await alert(u.id, "old");
    await setEmailAlerts(u.id, true);
    await alert(u.id, "new");
    const failing = fakeMailer(true);
    expect((await sendDueAlertEmails(new Date(), failing.mailer)).sent).toBe(0);
    const ok = fakeMailer();
    await sendDueAlertEmails(new Date(), ok.mailer);
    expect(ok.sent).toHaveLength(1);
    expect(ok.sent[0]!.text).toContain("/announcements/new");
    expect(ok.sent[0]!.text).not.toContain("/announcements/old");
  });
});
