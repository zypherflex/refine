import { NextResponse } from "next/server";

/**
 * iOS universal links: proves this site belongs to the App Store app, so /hub links open in the app.
 * Set APPLE_TEAM_ID (10 characters, from the Apple Developer account) and optionally IOS_BUNDLE_ID.
 */
export function GET() {
  const team = process.env.APPLE_TEAM_ID;
  if (!team) return new NextResponse("Not configured", { status: 404 });
  const appID = `${team}.${process.env.IOS_BUNDLE_ID ?? "ng.refinerylens.app"}`;
  return NextResponse.json({ applinks: { details: [{ appIDs: [appID], components: [{ "/": "/hub/*" }, { "/": "/hub" }] }] } });
}
