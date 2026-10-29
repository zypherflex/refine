/** Pulls every available open-data feed once and prints what happened. Run with `npm run ingest`. */
import { runOpenDataIngestion } from "../src/server/opendata/ingest";

runOpenDataIngestion()
  .then((runs) => {
    for (const r of runs) console.log(`${r.provider.padEnd(17)} ${r.status.padEnd(8)} ${String(r.itemsUpserted).padStart(5)} items  ${r.message}`);
    process.exit(runs.some((r) => r.status === "FAILED") ? 1 : 0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
