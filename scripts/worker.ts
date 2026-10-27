/** Background worker: processes queued jobs (document extraction), sends morning price alerts and alert emails, and refreshes open-data feeds. Run with `npm run worker`. */
import { drainQueue } from "../src/server/jobs";
import { jobHandlers } from "../src/server/job-handlers";
import { sendDueAlertEmails } from "../src/server/services/alert-email";
import { getMailer } from "../src/server/email";
import { scheduleIngestionIfDue } from "../src/server/opendata/ingest";
import { sendMorningPriceAlerts } from "../src/server/hub/alerts";

const EMAIL_INTERVAL_MS = 60_000;
const OPEN_DATA_INTERVAL_MS = Number(process.env.OPEN_DATA_INTERVAL_HOURS ?? 12) * 3_600_000;
const OPEN_DATA_CHECK_MS = 10 * 60_000;

async function loop() {
  console.log(`RefineryLens worker started (alert email ${getMailer() ? "enabled" : "not configured; in-app alerts only"}; open data ${OPEN_DATA_INTERVAL_MS > 0 ? `every ${OPEN_DATA_INTERVAL_MS / 3_600_000} h` : "off"})`);
  let lastEmail = 0;
  let lastOpenDataCheck = 0;
  for (;;) {
    const n = await drainQueue(jobHandlers, 20).catch((e) => {
      console.error("worker error", e);
      return 0;
    });
    if (Date.now() - lastEmail > EMAIL_INTERVAL_MS) {
      lastEmail = Date.now();
      // Morning price alerts first, so the email pass right after can carry them.
      await sendMorningPriceAlerts().catch((e) => console.error("price alert error", e));
      await sendDueAlertEmails().catch((e) => console.error("alert email error", e));
    }
    if (OPEN_DATA_INTERVAL_MS > 0 && Date.now() - lastOpenDataCheck > OPEN_DATA_CHECK_MS) {
      lastOpenDataCheck = Date.now();
      await scheduleIngestionIfDue(OPEN_DATA_INTERVAL_MS).catch((e) => console.error("open data error", e));
    }
    if (n === 0) await new Promise((r) => setTimeout(r, 3000));
  }
}
loop();
