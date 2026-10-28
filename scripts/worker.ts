/** Background worker: processes queued jobs (document extraction) and sends alert emails. Run with `npm run worker`. */
import { drainQueue } from "../src/server/jobs";
import { jobHandlers } from "../src/server/job-handlers";
import { sendDueAlertEmails } from "../src/server/services/alert-email";
import { getMailer } from "../src/server/email";

const EMAIL_INTERVAL_MS = 60_000;

async function loop() {
  console.log(`RefineryLens worker started (alert email ${getMailer() ? "enabled" : "not configured; in-app alerts only"})`);
  let lastEmail = 0;
  for (;;) {
    const n = await drainQueue(jobHandlers, 20).catch((e) => {
      console.error("worker error", e);
      return 0;
    });
    if (Date.now() - lastEmail > EMAIL_INTERVAL_MS) {
      lastEmail = Date.now();
      await sendDueAlertEmails().catch((e) => console.error("alert email error", e));
    }
    if (n === 0) await new Promise((r) => setTimeout(r, 3000));
  }
}
loop();
