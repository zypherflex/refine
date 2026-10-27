import { apiUser, json } from "@/server/hub/api";
import { METHODOLOGY } from "@/server/hub/priceindex";
import { priceBoard } from "@/server/hub/prices";

/** Today's published medians only: cells without enough sellers are left out. */
export async function GET(req: Request) {
  const auth = await apiUser(req);
  if (auth.error) return auth.error;
  const cells = (await priceBoard()).filter((c) => c.median != null);
  return json({
    currency: "NGN",
    methodology: METHODOLOGY,
    source: "RefineryLens price board",
    medians: cells.map((c) => ({ product: c.product, state: c.state, median: c.median, sellers: c.sellers, verifiedSellers: c.verifiedSellers, from: c.oldest?.toISOString().slice(0, 10), to: c.latest?.toISOString().slice(0, 10), includesSampleData: c.includesSample })),
  });
}
