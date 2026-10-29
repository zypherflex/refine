import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { apnsJwt, getPushSender, setApnsTransportForTests, signJwt } from "@/server/connect/push";
import { registerDevice, sendDueAlertPushes, unregisterDevice } from "@/server/services/alert-push";
import { createAlert } from "@/server/services/alerts";
import { integrationStatus } from "@/server/integrations";
import { resetDb, user } from "../helpers";

const saved = { ...process.env };
const rsa = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const ec = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
const pem = (k: crypto.KeyObject) => k.export({ type: "pkcs8", format: "pem" }).toString();
const TOKEN = "f".repeat(64);

beforeEach(resetDb);
afterEach(() => {
  process.env = { ...saved };
  vi.unstubAllGlobals();
  setApnsTransportForTests(null);
});

function verifyJwt(jwt: string, key: crypto.KeyObject, alg: "RS256" | "ES256") {
  const [h, c, s] = jwt.split(".");
  const ok = alg === "RS256" ? crypto.verify("RSA-SHA256", Buffer.from(`${h}.${c}`), key, Buffer.from(s, "base64url")) : crypto.verify("sha256", Buffer.from(`${h}.${c}`), { key, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url"));
  return { ok, header: JSON.parse(Buffer.from(h, "base64url").toString()), claims: JSON.parse(Buffer.from(c, "base64url").toString()) };
}

describe("push notifications", () => {
  it("signs RS256 and ES256 tokens that verify", () => {
    const r = verifyJwt(signJwt({ alg: "RS256" }, { a: 1 }, pem(rsa.privateKey), "RS256"), rsa.publicKey, "RS256");
    expect(r.ok).toBe(true);
    Object.assign(process.env, { APNS_KEY_P8: pem(ec.privateKey), APNS_KEY_ID: "ABC123DEFG", APNS_TEAM_ID: "TEAM123456", APNS_BUNDLE_ID: "ng.refinerylens.app" });
    const a = verifyJwt(apnsJwt(Date.now() + 3_600_000), ec.publicKey, "ES256");
    expect(a.ok).toBe(true);
    expect(a.header).toEqual({ alg: "ES256", kid: "ABC123DEFG" });
    expect(a.claims.iss).toBe("TEAM123456");
  });

  it("sends Android pushes through FCM v1 with a service-account token", async () => {
    process.env.FCM_SERVICE_ACCOUNT_JSON = JSON.stringify({ client_email: "push@proj.iam.gserviceaccount.com", private_key: pem(rsa.privateKey), project_id: "refinerylens-test" });
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      if (String(url).includes("oauth2")) return new Response(JSON.stringify({ access_token: "ya29.test", expires_in: 3600 }));
      if (String(init.body).includes('"token":"dead')) return new Response(JSON.stringify({ error: { status: "NOT_FOUND", message: "Requested entity was not found." } }), { status: 404 });
      return new Response(JSON.stringify({ name: "projects/refinerylens-test/messages/1" }));
    });
    const sender = getPushSender()!;
    expect(sender.android).toBe(true);
    expect(await sender.send("android", "tok-1", { title: "Hi", body: "Body", link: "/hub/inbox/1" })).toBe("sent");
    const oauth = new URLSearchParams(String(calls[0].init.body));
    const grant = verifyJwt(oauth.get("assertion")!, rsa.publicKey, "RS256");
    expect(grant.ok).toBe(true);
    expect(grant.claims.scope).toBe("https://www.googleapis.com/auth/firebase.messaging");
    const send = calls.find((c) => c.url.includes("fcm.googleapis.com"))!;
    expect(send.url).toBe("https://fcm.googleapis.com/v1/projects/refinerylens-test/messages:send");
    expect((send.init.headers as Record<string, string>).Authorization).toBe("Bearer ya29.test");
    expect(JSON.parse(String(send.init.body)).message).toMatchObject({ token: "tok-1", notification: { title: "Hi" }, data: { link: "/hub/inbox/1" } });
    expect(await sender.send("android", "dead-token", { title: "Hi", body: "", link: "/" })).toBe("gone");
    expect(integrationStatus().push).toEqual({ android: true, ios: false });
  });

  it("sends iOS pushes to APNs with the bundle topic and treats 410 as gone", async () => {
    Object.assign(process.env, { APNS_KEY_P8: pem(ec.privateKey), APNS_KEY_ID: "ABC123DEFG", APNS_TEAM_ID: "TEAM123456", APNS_BUNDLE_ID: "ng.refinerylens.app", APNS_PRODUCTION: "false" });
    const seen: { host: string; path: string; headers: Record<string, string>; body: string }[] = [];
    setApnsTransportForTests(async (host, path, headers, body) => {
      seen.push({ host, path, headers, body });
      return path.includes("gone") ? { status: 410, body: JSON.stringify({ reason: "Unregistered" }) } : { status: 200, body: "" };
    });
    const sender = getPushSender()!;
    expect(await sender.send("ios", TOKEN, { title: "Quote", body: "New quote", link: "/hub/jobs/1" })).toBe("sent");
    expect(seen[0]).toMatchObject({ host: "api.sandbox.push.apple.com", path: `/3/device/${TOKEN}` });
    expect(seen[0].headers).toMatchObject({ "apns-topic": "ng.refinerylens.app", "apns-push-type": "alert" });
    expect(JSON.parse(seen[0].body)).toMatchObject({ aps: { alert: { title: "Quote" } }, link: "/hub/jobs/1" });
    expect(await sender.send("ios", "gone", { title: "", body: "", link: "/" })).toBe("gone");
  });

  it("delivers hub alerts once to each phone, moves a token to whoever signs in, and drops dead tokens", async () => {
    const a = await user();
    const b = await user();
    await createAlert({ userId: a.id, kind: "HUB_MESSAGE", title: "Backlog", body: "", link: "/hub/inbox", dedupeKey: "old" });
    await registerDevice(a.id, { token: TOKEN, platform: "ios" });
    await registerDevice(a.id, { token: "d".repeat(64), platform: "android" });
    await createAlert({ userId: a.id, kind: "HUB_JOB", title: "New quote", body: "From Corridor", link: "/hub/jobs/1", dedupeKey: "q1" });
    await createAlert({ userId: a.id, kind: "NEW_ANNOUNCEMENT", title: "Research", body: "", link: "/x", dedupeKey: "r1" });
    const sent: string[] = [];
    const sender = { android: true, ios: true, async send(_p: string, token: string, m: { title: string }) { sent.push(`${token.slice(0, 1)}:${m.title}`); return token.startsWith("d") ? ("gone" as const) : ("sent" as const); } };
    expect(await sendDueAlertPushes(new Date(), sender)).toEqual({ sent: 1, removed: 1 });
    expect(sent.sort()).toEqual(["d:New quote", "f:New quote"]);
    expect(await sendDueAlertPushes(new Date(), sender)).toEqual({ sent: 0, removed: 0 });
    expect(await db.deviceToken.count()).toBe(1);

    await registerDevice(b.id, { token: TOKEN, platform: "ios" });
    expect((await db.deviceToken.findUniqueOrThrow({ where: { token: TOKEN } })).userId).toBe(b.id);
    await unregisterDevice(a.id, TOKEN); // not a's any more: nothing happens
    expect(await db.deviceToken.count()).toBe(1);
    await unregisterDevice(b.id, TOKEN);
    expect(await db.deviceToken.count()).toBe(0);
    await expect(registerDevice(a.id, { token: "short", platform: "ios" })).rejects.toThrow();
  });
});
