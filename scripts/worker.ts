/** Background worker: processes queued jobs, sends alert emails and refreshes open-data feeds. Run with `npm run worker`. */
import { drainQueue } from "../src/server/jobs";
import { jobHandlers } from "../src/server/job-handlers";
import { sendDueAlertEmails } from "../src/server/services/alert-email";
import { sendDueAlertTexts, sendPriceDigests } from "../src/server/services/alert-text";
import { getTextSender } from "../src/server/connect/text";
import { sendDueAlertPushes } from "../src/server/services/alert-push";
import { getPushSender } from "../src/server/connect/push";
import { getMailer } from "../src/server/email";
import { sendRefillReminders } from "../src/server/everyday/cylinders";
import { tidyTrips } from "../src/server/tracking";
import { refreshIndexIfDue } from "../src/server/data/index-builder";
import { sendDataRenewalReminders } from "../src/server/data/accounts";
import { scheduleIngestionIfDue } from "../src/server/opendata/ingest";

const EMAIL_INTERVAL_MS = 60_000;
const OPEN_DATA_INTERVAL_MS = Number(process.env.OPEN_DATA_INTERVAL_HOURS ?? 12) * 3_600_000;
const OPEN_DATA_CHECK_MS = 10 * 60_000;

async function loop() {
  console.log(`RefineryLens worker started (alert email ${getMailer() ? "enabled" : "not configured; in-app alerts only"}; texts ${getTextSender()?.provider ?? "not configured"}; open data ${OPEN_DATA_INTERVAL_MS > 0 ? `every ${OPEN_DATA_INTERVAL_MS / 3_600_000} h` : "off"})`);
  let lastEmail = 0;
  let lastOpenDataCheck = 0;
  for (;;) {
    const n = await drainQueue(jobHandlers, 20).catch((e) => {
      console.error("worker error", e);
      return 0;
    });
    if (Date.now() - lastEmail > EMAIL_INTERVAL_MS) {
      lastEmail = Date.now();
      // Refill reminders become alerts first, so the email, push and text passes below deliver them straight away.
      await sendRefillReminders().catch((e) => console.error("refill reminder error", e));
      await tidyTrips().catch((e) => console.error("trip tidy error", e));
      await refreshIndexIfDue().catch((e) => console.error("price index error", e));
      await sendDataRenewalReminders().catch((e) => console.error("data renewal error", e));
      await sendDueAlertEmails().catch((e) => console.error("alert email error", e));
      if (getPushSender()) await sendDueAlertPushes().catch((e) => console.error("push error", e));
      if (getTextSender()) {
        await sendDueAlertTexts().catch((e) => console.error("alert text error", e));
        await sendPriceDigests().catch((e) => console.error("price digest error", e));
      }
    }
    if (OPEN_DATA_INTERVAL_MS > 0 && Date.now() - lastOpenDataCheck > OPEN_DATA_CHECK_MS) {
      lastOpenDataCheck = Date.now();
      await scheduleIngestionIfDue(OPEN_DATA_INTERVAL_MS).catch((e) => console.error("open data error", e));
    }
    if (n === 0) await new Promise((r) => setTimeout(r, 3000));
  }
}
loop();
