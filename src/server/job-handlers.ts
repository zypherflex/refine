import type { JobHandler } from "./jobs";
import { processDocument } from "./services/documents";

export const jobHandlers: Record<string, JobHandler> = {
  "document.extract": async (p: { documentId: string }) => processDocument(p.documentId),
};
