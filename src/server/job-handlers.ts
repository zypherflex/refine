import type { JobHandler } from "./jobs";
import { runOpenDataIngestion } from "./opendata/ingest";
import { lookupBusiness } from "./connect/registry";
import { geocodeSite } from "./connect/geocode";

export const jobHandlers: Record<string, JobHandler> = {
  "opendata.ingest": async (p: { actorId?: string }) => {
    await runOpenDataIngestion({ actorId: p.actorId });
  },
  "hub.registry-lookup": async (p: { businessId: string }) => {
    await lookupBusiness(p.businessId);
  },
  "gas.geocode": async (p: { siteId: string }) => {
    await geocodeSite(p.siteId);
  },
};
