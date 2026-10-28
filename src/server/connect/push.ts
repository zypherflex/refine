import crypto from "node:crypto";
import http2 from "node:http2";
import { callJson, ConnectorError } from "./http";

/**
 * Push notifications for the store apps.
 * - Android: Firebase Cloud Messaging HTTP v1, POST https://fcm.googleapis.com/v1/projects/{id}/messages:send with an
 *   OAuth token from a service account (scope firebase.messaging). Docs: https://firebase.google.com/docs/cloud-messaging/send/v1-api
 * - iOS: APNs directly over HTTP/2 with a token signed by an Apple .p8 key (ES256; kid = key ID, iss = team ID),
 *   POST /3/device/{token} with apns-topic = bundle ID and apns-push-type = alert.
 *   Docs: https://developer.apple.com/documentation/usernotifications/establishing-a-token-based-connection-to-apns
 */

export type PushMessage = { title: string; body: string; link: string };
/** "gone" means the device token is no longer valid and should be deleted. */
export type PushResult = "sent" | "gone";
export type PushSender = { android: boolean; ios: boolean; send(platform: string, token: string, msg: PushMessage): Promise<PushResult> };

let override: PushSender | null = null;
export function setPushSenderForTests(s: PushSender | null) {
  override = s;
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

type ServiceAccount = { client_email: string; private_key: string; project_id: string; token_uri?: string };

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const sa = JSON.parse(json) as ServiceAccount;
    return sa.client_email && sa.private_key && sa.project_id ? sa : null;
  } catch {
    return null;
  }
}

export function apnsConfigured() {
  return Boolean(process.env.APNS_KEY_P8 && process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_BUNDLE_ID);
}
export function fcmConfigured() {
  return serviceAccount() !== null;
}

/** Signs a JWT. RS256 for Google service accounts, ES256 (raw r||s signature) for Apple keys. */
export function signJwt(header: object, claims: object, key: string, alg: "RS256" | "ES256") {
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const sig = alg === "RS256" ? crypto.sign("RSA-SHA256", Buffer.from(input), key) : crypto.sign("sha256", Buffer.from(input), { key, dsaEncoding: "ieee-p1363" });
  return `${input}.${b64url(sig)}`;
}

let googleToken: { value: string; expires: number } | null = null;

async function googleAccessToken(sa: ServiceAccount) {
  if (googleToken && googleToken.expires > Date.now() + 60_000) return googleToken.value;
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = sa.token_uri ?? "https://oauth2.googleapis.com/token";
  const assertion = signJwt({ alg: "RS256", typ: "JWT" }, { iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: tokenUri, iat: now, exp: now + 3600 }, sa.private_key, "RS256");
  const res = await callJson<{ access_token: string; expires_in: number }>("Google OAuth", tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
  });
  googleToken = { value: res.access_token, expires: Date.now() + res.expires_in * 1000 };
  return googleToken.value;
}

async function sendFcm(token: string, msg: PushMessage): Promise<PushResult> {
  const sa = serviceAccount()!;
  const access = await googleAccessToken(sa);
  try {
    await callJson("FCM", `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: msg.title, body: msg.body },
          data: { link: msg.link },
          android: { priority: "HIGH", notification: { channel_id: "trade", color: "#087c47" } },
        },
      }),
    });
    return "sent";
  } catch (e) {
    // FCM answers 404 UNREGISTERED (or 400 INVALID_ARGUMENT for a malformed token) when the app is gone.
    if (e instanceof ConnectorError && (e.status === 404 || (e.status === 400 && /registration token/i.test(e.message)))) return "gone";
    throw e;
  }
}

let appleToken: { value: string; made: number } | null = null;

/** Apple rejects tokens older than an hour and throttles fresh ones per request, so one is reused for 40 minutes. */
export function apnsJwt(now = Date.now()) {
  if (appleToken && now - appleToken.made < 40 * 60_000) return appleToken.value;
  const key = process.env.APNS_KEY_P8!.replace(/\\n/g, "\n");
  appleToken = { value: signJwt({ alg: "ES256", kid: process.env.APNS_KEY_ID }, { iss: process.env.APNS_TEAM_ID, iat: Math.floor(now / 1000) }, key, "ES256"), made: now };
  return appleToken.value;
}

export type ApnsTransport = (host: string, path: string, headers: Record<string, string>, body: string) => Promise<{ status: number; body: string }>;

const http2Transport: ApnsTransport = (host, path, headers, body) =>
  new Promise((resolve, reject) => {
    const client = http2.connect(`https://${host}`);
    client.on("error", reject);
    const req = client.request({ ":method": "POST", ":path": path, ...headers });
    let status = 0;
    let data = "";
    req.setTimeout(15_000, () => req.close(http2.constants.NGHTTP2_CANCEL));
    req.on("response", (h) => (status = Number(h[":status"])));
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      client.close();
      resolve({ status, body: data });
    });
    req.on("error", (e) => {
      client.close();
      reject(e);
    });
    req.end(body);
  });

let apnsTransport: ApnsTransport = http2Transport;
export function setApnsTransportForTests(t: ApnsTransport | null) {
  apnsTransport = t ?? http2Transport;
}

async function sendApns(token: string, msg: PushMessage): Promise<PushResult> {
  const host = process.env.APNS_PRODUCTION === "false" ? "api.sandbox.push.apple.com" : "api.push.apple.com";
  const res = await apnsTransport(
    host,
    `/3/device/${token}`,
    { authorization: `bearer ${apnsJwt()}`, "apns-topic": process.env.APNS_BUNDLE_ID!, "apns-push-type": "alert", "apns-priority": "10", "content-type": "application/json" },
    JSON.stringify({ aps: { alert: { title: msg.title, body: msg.body }, sound: "default" }, link: msg.link }),
  );
  if (res.status === 200) return "sent";
  const reason = (() => {
    try {
      return (JSON.parse(res.body) as { reason?: string }).reason ?? "";
    } catch {
      return "";
    }
  })();
  // 410 Unregistered: the app was removed. 400 BadDeviceToken: the token is for the other environment or invalid.
  if (res.status === 410 || reason === "BadDeviceToken" || reason === "Unregistered") return "gone";
  throw new ConnectorError("APNs", reason || `HTTP ${res.status}`, res.status);
}

export function getPushSender(): PushSender | null {
  if (override) return override;
  const android = fcmConfigured();
  const ios = apnsConfigured();
  if (!android && !ios) return null;
  return {
    android,
    ios,
    async send(platform, token, msg) {
      if (platform === "android" && android) return sendFcm(token, msg);
      if (platform === "ios" && ios) return sendApns(token, msg);
      throw new ConnectorError("Push", `${platform} push is not configured`);
    },
  };
}
