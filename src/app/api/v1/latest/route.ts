import type { NextRequest } from "next/server";
import { latestEndpoint, withKey } from "@/server/data/api";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return withKey(req, latestEndpoint);
}
