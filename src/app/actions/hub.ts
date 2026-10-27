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
