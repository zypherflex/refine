import { afterEach, describe, expect, it } from "vitest";
import { GET as assetlinks } from "@/app/.well-known/assetlinks.json/route";
import { GET as aasa } from "@/app/.well-known/apple-app-site-association/route";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe("app link verification files", () => {
  it("serve nothing until configured", async () => {
    delete process.env.ANDROID_CERT_SHA256;
    delete process.env.APPLE_TEAM_ID;
    expect(assetlinks().status).toBe(404);
    expect(aasa().status).toBe(404);
  });

  it("describe the Android app and its signing fingerprints", async () => {
    process.env.ANDROID_CERT_SHA256 = "AA:BB, CC:DD";
    const body = await assetlinks().json();
    expect(body[0].target).toEqual({ namespace: "android_app", package_name: "ng.refinerylens.app", sha256_cert_fingerprints: ["AA:BB", "CC:DD"] });
  });

  it("describe the iOS app for hub links", async () => {
    process.env.APPLE_TEAM_ID = "ABCDE12345";
    const body = await aasa().json();
    expect(body.applinks.details[0].appIDs).toEqual(["ABCDE12345.ng.refinerylens.app"]);
    expect(body.applinks.details[0].components).toContainEqual({ "/": "/hub/*" });
  });
});
