import { ZodError } from "zod";
import { apiUser, json } from "@/server/hub/api";
import { METHODOLOGY, priceHistory } from "@/server/hub/priceindex";

export async function GET(req: Request) {
  const auth = await apiUser(req);
  if (auth.error) return auth.error;
  const p = new URL(req.url).searchParams;
  const query = { product: p.get("product") ?? "", state: p.get("state") ?? "NG", weeks: Number(p.get("weeks") ?? 26) };
  try {
    const points = await priceHistory(query);
    return json({ product: query.product, state: query.state, currency: "NGN", methodology: METHODOLOGY, source: "RefineryLens price index", points });
  } catch (e) {
    if (e instanceof ZodError) return json({ error: e.issues.map((i) => i.message).join(" ") }, 400);
    throw e;
  }
}
