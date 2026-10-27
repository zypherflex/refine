"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { isLang } from "@/lib/i18n/hub";
import { LANG_COOKIE } from "@/server/hub/lang";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireUser, type CurrentUser } from "@/server/auth";
import { AppError } from "@/lib/errors";
import { reportBusiness, requestVerification, resolveReport, reviewBusiness, saveBusiness, setBusinessPlan } from "@/server/hub/business";
import { createApiKey, revokeApiKey, setPriceDataAccess } from "@/server/hub/priceindex";
import { createPartner, lenderDecide, requestFinance, setPartnerActive, setPartnerStaff, withdrawFinance } from "@/server/hub/finance";
import { recordCylinders, registerCylinders } from "@/server/hub/cylinders";
import { addRecord, removeRecord, renewRecord, setInVendorPack } from "@/server/hub/compliance";
import { addThreshold, removeThreshold } from "@/server/hub/thresholds";
import { rateLimit } from "@/server/rate-limit";
import { assignVisit, decideVisit, markPaid, setFieldAgent, submitVisit } from "@/server/hub/field";
import { closeListing, createListing, sendEnquiry, setPromoted } from "@/server/hub/market";
import { reportPrice } from "@/server/hub/prices";
import { addSite, confirmSite, removeSite } from "@/server/hub/gas";
import { acceptQuote, cancelJob, confirmDelivery, postJob, quoteJob, withdrawQuote } from "@/server/hub/jobs";
import { confirmSupplyDelivery, endAgreement, proposeAgreement, recordDelivery, respondAgreement } from "@/server/hub/supply";
import { registerInterest } from "@/server/hub/plans";
import { confirmPhone, saveAlertSettings, startPhoneConfirmation } from "@/server/hub/alerts";

export type HubState = { error?: string | null; ok?: string | null };

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

function message(e: unknown): string {
  if (e instanceof ZodError) return e.issues.map((i) => i.message).join(" ");
  if (e instanceof AppError) return e.message;
  throw e;
}

/** Runs one hub change for the signed-in user and turns validation and rule errors into a message for the form. */
async function run(fn: (u: CurrentUser) => Promise<unknown>, ok: string): Promise<HubState> {
  const user = await requireUser();
  try {
    await fn(user);
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath("/hub", "layout");
  return { ok };
}

export async function saveBusinessAction(_: HubState, f: FormData) {
  return run((u) => saveBusiness(u, {
    name: str(f, "name"), roles: f.getAll("roles").map(String), products: f.getAll("products").map(String), state: str(f, "state"), town: str(f, "town"),
    description: str(f, "description"), phone: str(f, "phone"), cacNumber: str(f, "cacNumber"), licenceNumbers: str(f, "licenceNumbers"),
  }), "Business profile saved.");
}

export async function requestVerificationAction(): Promise<HubState> {
  return run((u) => requestVerification(u), "Verification requested. A reviewer will call you and check your documents.");
}

export async function reviewBusinessAction(_: HubState, f: FormData) {
  return run((u) => reviewBusiness(u, { businessId: str(f, "businessId"), decision: str(f, "decision") as never, note: str(f, "note") }), "Decision saved.");
}

export async function reportBusinessAction(_: HubState, f: FormData) {
  return run((u) => reportBusiness(u, { businessId: str(f, "businessId"), reason: str(f, "reason"), details: str(f, "details") }), "Thank you. A reviewer will look at your report. Do not send money while it is open.");
}

export async function resolveReportAction(_: HubState, f: FormData) {
  return run((u) => resolveReport(u, str(f, "id")), "Report closed.");
}

export async function createListingAction(_: HubState, f: FormData) {
  return run((u) => createListing(u, { kind: str(f, "kind") as never, product: str(f, "product"), quantity: str(f, "quantity") as never, unit: str(f, "unit") as never, state: str(f, "state"), details: str(f, "details") }), "Listing is live for 30 days.");
}

export async function closeListingAction(_: HubState, f: FormData) {
  return run((u) => closeListing(u, str(f, "id")), "Listing closed.");
}

export async function promoteListingAction(_: HubState, f: FormData) {
  return run((u) => setPromoted(u, str(f, "id"), str(f, "promoted") === "1"), "Placement updated.");
}

export async function sendEnquiryAction(_: HubState, f: FormData) {
  return run((u) => sendEnquiry(u, { toId: str(f, "toId"), listingId: str(f, "listingId") || null, message: str(f, "message") }), "Message sent. They will see it in their hub inbox.");
}

export async function reportPriceAction(_: HubState, f: FormData) {
  return run((u) => reportPrice(u, { product: str(f, "product"), state: str(f, "state"), priceNgn: str(f, "priceNgn") as never, chargedOn: str(f, "chargedOn") as never, confirmCharged: (f.get("confirmCharged") === "on") as true }), "Price recorded. It counts towards the median once enough sellers report.");
}

export async function addSiteAction(_: HubState, f: FormData) {
  return run((u) => addSite(u, { kind: str(f, "kind") as never, gas: str(f, "gas") as never, name: str(f, "name"), state: str(f, "state"), town: str(f, "town"), capacityNote: str(f, "capacityNote") }), "Site added to the gas map.");
}

export async function confirmSiteAction(_: HubState, f: FormData) {
  return run((u) => confirmSite(u, str(f, "id")), "Site confirmed as current.");
}

export async function removeSiteAction(_: HubState, f: FormData) {
  return run((u) => removeSite(u, str(f, "id")), "Site removed.");
}

export async function postJobAction(_: HubState, f: FormData): Promise<HubState> {
  const user = await requireUser();
  let id: string;
  try {
    id = (await postJob(user, { product: str(f, "product"), quantity: str(f, "quantity") as never, unit: str(f, "unit") as never, fromState: str(f, "fromState"), fromPlace: str(f, "fromPlace"), toState: str(f, "toState"), toPlace: str(f, "toPlace"), readyBy: str(f, "readyBy") as never, notes: str(f, "notes") })).id;
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath("/hub", "layout");
  redirect(`/hub/jobs/${id}`);
}

export async function quoteJobAction(_: HubState, f: FormData) {
  return run((u) => quoteJob(u, { jobId: str(f, "jobId"), priceNgn: str(f, "priceNgn") as never, days: str(f, "days") as never, note: str(f, "note") }), "Quote sent. The poster sees every quote and picks one.");
}

export async function withdrawQuoteAction(_: HubState, f: FormData) {
  return run((u) => withdrawQuote(u, str(f, "id")), "Quote withdrawn.");
}

export async function acceptQuoteAction(_: HubState, f: FormData) {
  return run((u) => acceptQuote(u, str(f, "id")), "Quote accepted. Other quotes were declined.");
}

export async function confirmJobAction(_: HubState, f: FormData) {
  return run((u) => confirmDelivery(u, str(f, "id")), "Your confirmation is recorded.");
}

export async function cancelJobAction(_: HubState, f: FormData) {
  return run((u) => cancelJob(u, str(f, "id")), "Job cancelled.");
}

export async function proposeAgreementAction(_: HubState, f: FormData): Promise<HubState> {
  const user = await requireUser();
  let id: string;
  try {
    id = (await proposeAgreement(user, { counterpartyId: str(f, "counterpartyId"), myRole: str(f, "myRole") as never, product: str(f, "product"), quantity: str(f, "quantity") as never, unit: str(f, "unit") as never, frequency: str(f, "frequency") as never, deliverTo: str(f, "deliverTo"), startsOn: str(f, "startsOn") as never })).id;
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath("/hub", "layout");
  redirect(`/hub/supply/${id}`);
}

export async function respondAgreementAction(_: HubState, f: FormData) {
  const accept = str(f, "accept") === "1";
  return run((u) => respondAgreement(u, str(f, "id"), accept), accept ? "Agreement is active." : "Proposal declined.");
}

export async function endAgreementAction(_: HubState, f: FormData) {
  return run((u) => endAgreement(u, str(f, "id")), "Agreement ended. Its delivery record stays.");
}

export async function recordDeliveryAction(_: HubState, f: FormData) {
  return run((u) => recordDelivery(u, { agreementId: str(f, "agreementId"), deliveredOn: str(f, "deliveredOn") as never, quantity: str(f, "quantity") as never, note: str(f, "note") }), "Delivery recorded. It counts once the other side confirms it.");
}

export async function confirmSupplyDeliveryAction(_: HubState, f: FormData) {
  return run((u) => confirmSupplyDelivery(u, str(f, "id")), "Delivery confirmed by both sides.");
}

export async function registerInterestAction(_: HubState, f: FormData): Promise<HubState> {
  const user = await requireUser();
  try {
    await registerInterest(user, { line: str(f, "line"), message: str(f, "message") });
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath("/plans");
  return { ok: "Thanks. We will contact you before launch. No payment has been taken." };
}

export async function setLangAction(f: FormData) {
  await requireUser();
  const lang = str(f, "lang");
  if (!isLang(lang)) return;
  (await cookies()).set(LANG_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true });
  revalidatePath("/hub", "layout");
}

export async function saveAlertsAction(_: HubState, f: FormData) {
  return run((u) => saveAlertSettings(u, { states: f.getAll("states").map(String), products: f.getAll("products").map(String), channels: f.getAll("channels").map(String) as never, language: str(f, "language"), active: f.get("active") === "on" }), "Alert settings saved.");
}

export async function sendPhoneCodeAction(_: HubState, f: FormData) {
  return run((u) => startPhoneConfirmation(u, str(f, "phone")), "Code sent. It is valid for 15 minutes.");
}

export async function confirmPhoneAction(_: HubState, f: FormData) {
  return run((u) => confirmPhone(u, str(f, "code")), "Number confirmed. Text alerts will go to it.");
}

export async function setBusinessPlanAction(_: HubState, f: FormData) {
  return run((u) => setBusinessPlan(u, { businessId: str(f, "businessId"), plan: str(f, "plan") as never, months: Number(str(f, "months")) || 12 }), "Plan saved.");
}

export async function setFieldAgentAction(_: HubState, f: FormData) {
  return run((u) => setFieldAgent(u, { email: str(f, "email"), areas: f.getAll("areas").map(String), enabled: str(f, "enabled") !== "0" }), "Field agent saved.");
}

export async function assignVisitAction(_: HubState, f: FormData) {
  return run((u) => assignVisit(u, str(f, "businessId"), str(f, "agentId")), "Visit assigned.");
}

export async function submitVisitAction(_: HubState, f: FormData) {
  const tick = (k: string) => f.get(k) === "on";
  return run((u) => submitVisit(u, {
    visitId: str(f, "visitId"), visitedOn: new Date(str(f, "visitedOn")), cacSeen: tick("cacSeen"), licenceSeen: tick("licenceSeen"), premisesSeen: tick("premisesSeen"),
    phoneAnswered: tick("phoneAnswered"), productSeen: tick("productSeen"), notes: str(f, "notes"),
  }), "Visit report sent for review.");
}

export async function decideVisitAction(_: HubState, f: FormData) {
  return run((u) => decideVisit(u, str(f, "visitId"), str(f, "decision") === "ACCEPT", str(f, "note")), "Decision saved.");
}

export async function markPaidAction(_: HubState, f: FormData) {
  return run((u) => markPaid(u, str(f, "visitId")), "Marked paid.");
}

export async function setPriceDataAction(_: HubState, f: FormData) {
  return run((u) => setPriceDataAccess(u, { email: str(f, "email"), months: Number(str(f, "months")) }), "Price data access saved.");
}

export type KeyState = HubState & { key?: string | null };

/** Returns the new key once, so the page can show it to copy. */
export async function createApiKeyAction(_: KeyState, f: FormData): Promise<KeyState> {
  const user = await requireUser();
  try {
    const { key } = await createApiKey(user, str(f, "name"));
    revalidatePath("/hub/data");
    return { ok: "Key created. Copy it now: it will not be shown again.", key };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function revokeApiKeyAction(_: HubState, f: FormData) {
  return run((u) => revokeApiKey(u, str(f, "id")), "Key revoked.");
}

export async function createPartnerAction(_: HubState, f: FormData) {
  return run((u) => createPartner(u, { name: str(f, "name"), description: str(f, "description"), states: f.getAll("states").map(String), products: f.getAll("products").map(String) }), "Lender partner added.");
}

export async function setPartnerActiveAction(_: HubState, f: FormData) {
  return run((u) => setPartnerActive(u, str(f, "partnerId"), str(f, "active") === "1"), "Saved.");
}

export async function setPartnerStaffAction(_: HubState, f: FormData) {
  return run((u) => setPartnerStaff(u, str(f, "partnerId"), str(f, "email"), str(f, "add") !== "0"), "Lender staff saved.");
}

export async function requestFinanceAction(_: HubState, f: FormData) {
  return run((u) => requestFinance(u, {
    partnerId: str(f, "partnerId"), amountNgn: Number(str(f, "amountNgn").replace(/[^0-9]/g, "")), purpose: str(f, "purpose"), product: str(f, "product"), notes: str(f, "notes"), consent: (f.get("consent") === "on") as true,
  }), "Your record is shared with the lender for 90 days. They will reply here.");
}

export async function withdrawFinanceAction(_: HubState, f: FormData) {
  return run((u) => withdrawFinance(u, str(f, "id")), "Withdrawn. The lender can no longer see your record.");
}

export async function lenderDecideAction(_: HubState, f: FormData) {
  return run((u) => lenderDecide(u, { requestId: str(f, "requestId"), status: str(f, "status") as never, note: str(f, "note") }), "Saved. The business has been told.");
}

export async function registerCylindersAction(_: HubState, f: FormData) {
  const user = await requireUser();
  try {
    const r = await registerCylinders(user, { prefix: str(f, "prefix"), from: Number(str(f, "from")), count: Number(str(f, "count")), sizeKg: Number(str(f, "sizeKg")), lastTestOn: new Date(str(f, "lastTestOn")) });
    revalidatePath("/hub", "layout");
    return { ok: `Registered ${r.count} cylinders: ${r.first} to ${r.last}.` };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function recordCylindersAction(_: HubState, f: FormData) {
  const user = await requireUser();
  try {
    const t = str(f, "testedOn");
    const r = await recordCylinders(user, { serials: str(f, "serials"), action: str(f, "action") as never, toBusinessId: str(f, "toBusinessId"), testedOn: t ? new Date(t) : undefined, note: str(f, "note") });
    revalidatePath("/hub", "layout");
    return { ok: `Recorded for ${r.count} cylinder${r.count === 1 ? "" : "s"}.` };
  } catch (e) {
    return { error: message(e) };
  }
}

const dateOrNull = (f: FormData, k: string) => (str(f, k) ? new Date(str(f, k)) : null);

async function fileOf(f: FormData) {
  const file = f.get("file");
  if (!(file instanceof File) || file.size === 0) return null;
  return { name: file.name, data: Buffer.from(await file.arrayBuffer()) };
}

export async function addComplianceAction(_: HubState, f: FormData) {
  return run(async (u) => {
    if (!rateLimit(`vault:${u.id}`, 40, 60 * 60_000)) throw new AppError("Upload limit reached. Try again in an hour.");
    await addRecord(u, {
      kind: str(f, "kind"), title: str(f, "title"), number: str(f, "number"), issuer: str(f, "issuer"),
      issuedOn: dateOrNull(f, "issuedOn"), expiresOn: dateOrNull(f, "expiresOn"), inVendorPack: f.get("inVendorPack") === "on",
    }, await fileOf(f));
  }, "Saved to your vault.");
}

export async function renewComplianceAction(_: HubState, f: FormData) {
  return run(async (u) => {
    if (!rateLimit(`vault:${u.id}`, 40, 60 * 60_000)) throw new AppError("Upload limit reached. Try again in an hour.");
    const expires = dateOrNull(f, "expiresOn");
    if (!expires) throw new AppError("Enter the new expiry date.");
    await renewRecord(u, { id: str(f, "id"), issuedOn: dateOrNull(f, "issuedOn"), expiresOn: expires, number: str(f, "number") || undefined }, await fileOf(f));
  }, "Renewal saved. Reminders will start again before the new date.");
}

export async function setInVendorPackAction(_: HubState, f: FormData) {
  return run((u) => setInVendorPack(u, str(f, "id"), str(f, "include") === "1"), "Saved.");
}

export async function removeComplianceAction(_: HubState, f: FormData) {
  return run((u) => removeRecord(u, str(f, "id")), "Removed.");
}

export async function addThresholdAction(_: HubState, f: FormData) {
  return run((u) => addThreshold(u, { product: str(f, "product"), state: str(f, "state"), direction: str(f, "direction") as never, priceNgn: Number(str(f, "priceNgn").replace(/[^0-9]/g, "")) }), "Alert added.");
}

export async function removeThresholdAction(_: HubState, f: FormData) {
  return run((u) => removeThreshold(u, str(f, "id")), "Alert removed.");
}
