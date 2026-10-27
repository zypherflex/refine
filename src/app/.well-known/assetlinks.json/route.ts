import { NextResponse } from "next/server";

/**
 * Android App Links: proves this site belongs to the Google Play app, so /hub links open in the app.
 * Set ANDROID_APP_ID (default ng.refinerylens.app) and ANDROID_CERT_SHA256 (the app signing key's SHA-256
 * fingerprint from Play Console > App integrity; several may be comma-separated).
 */
export function GET() {
  const prints = (process.env.ANDROID_CERT_SHA256 ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!prints.length) return new NextResponse("Not configured", { status: 404 });
  return NextResponse.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: process.env.ANDROID_APP_ID ?? "ng.refinerylens.app", sha256_cert_fingerprints: prints },
    },
  ]);
}
