import { db } from "@/lib/db";
import { getMailer, type Mailer } from "../email";

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const FOOTER = "RefineryLens is independent research and not investment advice. Change email settings under Watchlist and alerts.";

/**
 * Emails every alert that has become visible (immediate alerts now, digest alerts at their digest time) to users who
 * opted in, one message per user. Alerts are marked as emailed only after the send succeeds, so a failed send is retried.
 */
export async function sendDueAlertEmails(now = new Date(), mailer: Mailer | null = getMailer()) {
  if (!mailer) return { sent: 0, alerts: 0 };
  const due = await db.alert.findMany({
    where: { emailedAt: null, visibleAt: { lte: now }, user: { emailAlerts: true } },
    include: { user: { select: { id: true, email: true, name: true } } },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  const byUser = new Map<string, typeof due>();
  for (const a of due) byUser.set(a.userId, [...(byUser.get(a.userId) ?? []), a]);
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  let sent = 0;
  let alerts = 0;
  for (const list of byUser.values()) {
    const user = list[0]!.user;
    const urgent = list.some((a) => a.kind === "CORRECTION" || a.kind === "RETRACTION");
    const subject = list.length === 1 ? list[0]!.title : `${list.length} RefineryLens alerts${urgent ? ", including a correction or retraction" : ""}`;
    const text = [`Hello ${user.name},`, "", ...list.flatMap((a) => [`• ${a.title}`, `  ${a.body}`, `  ${base}${a.link}`, ""]), FOOTER].join("\n");
    const html = `<p>Hello ${esc(user.name)},</p>${list.map((a) => `<p><a href="${esc(base + a.link)}"><strong>${esc(a.title)}</strong></a><br>${esc(a.body)}</p>`).join("")}<p style="color:#66759a;font-size:12px">${esc(FOOTER)}</p>`;
    try {
      await mailer.send({ to: user.email, subject, text, html });
    } catch (e) {
      console.error("alert email failed", user.id, e);
      continue;
    }
    await db.alert.updateMany({ where: { id: { in: list.map((a) => a.id) } }, data: { emailedAt: new Date() } });
    sent++;
    alerts += list.length;
  }
  return { sent, alerts };
}

/** Opting in only covers alerts from now on; the existing backlog is not emailed. */
export async function setEmailAlerts(userId: string, enabled: boolean) {
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { emailAlerts: enabled } }),
    ...(enabled ? [db.alert.updateMany({ where: { userId, emailedAt: null, visibleAt: { lte: new Date() } }, data: { emailedAt: new Date() } })] : []),
  ]);
}
