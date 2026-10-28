import type { NextRequest } from "next/server";
import { nationalEndpoint, withKey } from "@/server/data/api";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return withKey(req, nationalEndpoint);
}
