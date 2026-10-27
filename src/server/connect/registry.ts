import { db } from "@/lib/db";
import { callJson } from "./http";

/**
 * Company registry lookup for verification, through Dojah's CAC lookup (GET /api/v1/kyc/cac/basic with AppId and the
 * secret key in Authorization). The result is stored for the administrator who verifies the business; it never
 * verifies a business on its own. Docs: https://docs.dojah.io/api-reference/business-verification/lookup-cac
 */

export function registryConfigured() {
  return (process.env.CAC_LOOKUP_PROVIDER ?? "").toLowerCase() === "dojah" && Boolean(process.env.DOJAH_APP_ID && process.env.DOJAH_SECRET_KEY);
}

/** CAC numbers are written "RC 1234567" (companies), "BN 1234567" (business names) or "IT 12345" (incorporated trustees). */
export function parseRegistration(raw: string): { number: string; companyType: string } | null {
  const m = raw.toUpperCase().replace(/[^A-Z0-9]/g, " ").trim().match(/^(RC|BN|IT|LP|LLP)?\s*(\d{3,9})$/);
  if (!m) return null;
  const type = { RC: "COMPANY", BN: "BUSINESS_NAME", IT: "INCORPORATED_TRUSTEES", LP: "LIMITED_PARTNERSHIP", LLP: "LIMITED_LIABILITY_PARTNERSHIP" }[m[1] ?? "RC"]!;
  return { number: m[2]!, companyType: type };
}

const flatten = (s: string) => s.toLowerCase().replace(/\b(limited|ltd|plc|nigeria|nig|company|co|enterprises?|ventures?)\b/g, "").replace(/[^a-z0-9]/g, "");

/** Whether the registry name matches the name on the profile, ignoring suffixes such as "Ltd". */
export function namesMatch(profileName: string, registryName: string) {
  const a = flatten(profileName.replace(/\(demo\)/i, ""));
  const b = flatten(registryName);
  return !!a && !!b && (a === b || a.includes(b) || b.includes(a));
}

export type RegistryCheck = { ok: boolean; name?: string; status?: string; address?: string; type?: string; matches?: boolean; numberMatches?: boolean; error?: string; source: "dojah" };

export async function lookupBusiness(businessId: string): Promise<RegistryCheck | null> {
  if (!registryConfigured()) return null;
  const b = await db.hubBusiness.findUnique({ where: { id: businessId } });
  if (!b) return null;
  const parsed = parseRegistration(b.registrationNumber);
  let check: RegistryCheck;
  if (!parsed) {
    check = { ok: false, error: "Registration number is not in a recognised CAC format", source: "dojah" };
  } else {
    try {
      const base = (process.env.DOJAH_BASE_URL ?? "https://api.dojah.io").replace(/\/$/, "");
      const url = `${base}/api/v1/kyc/cac/basic?rc_number=${encodeURIComponent(parsed.number)}&company_type=${parsed.companyType}`;
      // The basic lookup returns `entity`; some responses carry `address`, others only state, city and LGA.
      const res = await callJson<{ entity?: { company_name?: string; status?: string; address?: string; state?: string; city?: string; lga?: string; rc_number?: string | number; type_of_company?: string } }>("Dojah", url, {
        headers: { AppId: process.env.DOJAH_APP_ID!, Authorization: process.env.DOJAH_SECRET_KEY! },
      });
      const e = res.entity;
      check = e?.company_name
        ? {
            ok: true,
            name: e.company_name,
            status: e.status,
            type: e.type_of_company,
            address: e.address || [e.city, e.lga, e.state].filter(Boolean).join(", ") || undefined,
            matches: namesMatch(b.name, e.company_name),
            numberMatches: e.rc_number === undefined ? undefined : String(e.rc_number).replace(/\D/g, "") === parsed.number,
            source: "dojah",
          }
        : { ok: false, error: "No company found for that number", source: "dojah" };
    } catch (err) {
      check = { ok: false, error: err instanceof Error ? err.message : "Lookup failed", source: "dojah" };
    }
  }
  await db.hubBusiness.update({ where: { id: businessId }, data: { registryCheck: check, registryCheckedAt: new Date() } });
  return check;
}
