import type { JobHandler } from "./jobs";
import { processDocument } from "./services/documents";
import { runOpenDataIngestion } from "./opendata/ingest";

export const jobHandlers: Record<string, JobHandler> = {
  "document.extract": async (p: { documentId: string }) => processDocument(p.documentId),
  "opendata.ingest": async (p: { actorId?: string }) => {
    await runOpenDataIngestion({ actorId: p.actorId });
  },
};
