"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireRole, requireUser } from "@/server/auth";
import { requestVerification, saveBusiness } from "@/server/hub/business";
import { closeListing, createListing, renewListing, updateListing } from "@/server/hub/listings";
import { reply, sendEnquiry } from "@/server/hub/messages";
import { confirmSite, createSite, updateSite } from "@/server/hub/gas";
import { reportPrices } from "@/server/hub/prices";
import { acceptQuote, cancelJob, confirmDelivered, postJob, submitQuote, withdrawQuote } from "@/server/hub/jobs";
import { logDelivery, proposeAgreement, respond, reviewDelivery, setStatus } from "@/server/hub/supply";
import { closeReport, decideVerification, reinstateBusiness, reportBusiness, suspendBusiness } from "@/server/hub/moderation";
import { AppError } from "@/lib/errors";
import { BUSINESS_PLAN_DAYS, extendBusinessPlan, startBusinessCheckout } from "@/server/connect/paystack";
import { audit } from "@/server/audit";

export type ActionState = { error?: string | null; ok?: string | null };

function message(e: unknown): string {
  if (e instanceof ZodError) return e.issues.map((i) => `${i.path.join(".") || "Input"}: ${i.message}`).join(" ");
  if (e instanceof AppError) return e.message;
  throw e;
}

const text = (form: FormData, key: string) => String(form.get(key) ?? "");
/** Empty inputs mean "not given"; anything else must be a number (validation reports it otherwise). */
const num = (form: FormData, key: string) => {
  const v = text(form, key).replace(/,/g, "").trim();
  return v === "" ? null : Number(v);
};

export async function saveBusinessAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  try {
    await saveBusiness(user, {
      name: text(form, "name"),
      roles: form.getAll("roles").map(String) as never,
      about: text(form, "about"),
      state: text(form, "state"),
      city: text(form, "city"),
      website: text(form, "website"),
      registrationNumber: text(form, "registrationNumber"),
      licences: text(form, "licences"),
      capacityBpd: num(form, "capacityBpd"),
    });
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath("/hub", "layout");
  return { ok: "Business profile saved." };
}

export async function requestVerificationAction(): Promise<ActionState> {
  const user = await requireUser();
  try {
    await requestVerification(user);
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath("/hub", "layout");
  return { ok: "Verification requested. An administrator will check your registration and licence details." };
}

function listingFields(form: FormData) {
  return {
    kind: text(form, "kind") as never,
    title: text(form, "title"),
    details: text(form, "details"),
    products: form.getAll("products").map(String),
    quantity: num(form, "quantity"),
    unit: text(form, "unit") as never,
    priceNote: text(form, "priceNote"),
    state: text(form, "state"),
    areas: form.getAll("areas").map(String),
    days: Number(text(form, "days") || 30),
  };
}

export async function saveListingAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = text(form, "id");
  let listingId: string;
  try {
    listingId = id ? (await updateListing(user, id, listingFields(form))).id : (await createListing(user, listingFields(form))).id;
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath("/hub", "layout");
  redirect(`/hub/listings/${listingId}?saved=1`);
}

export async function closeListingAction(form: FormData) {
  const user = await requireUser();
  try {
    await closeListing(user, text(form, "id"));
  } catch (e) {
    message(e);
  }
  revalidatePath("/hub", "layout");
}

export async function renewListingAction(form: FormData) {
  const user = await requireUser();
  try {
    await renewListing(user, text(form, "id"));
  } catch (e) {
    message(e);
  }
  revalidatePath("/hub", "layout");
}

export async function sendEnquiryAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  let threadId: string;
  try {
    threadId = (await sendEnquiry(user, { businessId: text(form, "businessId"), listingId: text(form, "listingId") || null, body: text(form, "body") })).id;
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath("/hub", "layout");
  redirect(`/hub/inbox/${threadId}`);
}

export async function replyAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const threadId = text(form, "threadId");
  try {
    await reply(user, threadId, text(form, "body"));
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath(`/hub/inbox/${threadId}`);
  revalidatePath("/hub", "layout");
  return { ok: "Sent." };
}

export async function reportBusinessAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  try {
    await reportBusiness(user, { businessId: text(form, "businessId"), reason: text(form, "reason") });
  } catch (e) {
    return { error: message(e) };
  }
  return { ok: "Thank you. RefineryLens will review this business." };
}

export async function decideVerificationAction(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  try {
    await decideVerification(admin, text(form, "businessId"), text(form, "decision") === "VERIFY" ? "VERIFY" : "RETURN", text(form, "note"));
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath("/admin/hub");
  revalidatePath("/hub", "layout");
  return { ok: "Saved." };
}

export async function suspendBusinessAction(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  try {
    await suspendBusiness(admin, text(form, "businessId"), text(form, "note"));
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath("/admin/hub");
  revalidatePath("/hub", "layout");
  return { ok: "Business suspended." };
}

export async function reinstateBusinessAction(form: FormData) {
  const admin = await requireRole("ADMIN");
  await reinstateBusiness(admin, text(form, "businessId")).catch(message);
  revalidatePath("/admin/hub");
  revalidatePath("/hub", "layout");
}

export async function closeReportAction(form: FormData) {
  const admin = await requireRole("ADMIN");
  await closeReport(admin, text(form, "id")).catch(message);
  revalidatePath("/admin/hub");
}

export async function saveSiteAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = text(form, "id");
  const fields = {
    name: text(form, "name"),
    kind: text(form, "kind") as never,
    status: (text(form, "status") || "OPERATING") as never,
    gases: form.getAll("gases").map(String),
    cylinderSizes: form.getAll("cylinderSizes").map(Number),
    state: text(form, "state"),
    town: text(form, "town"),
    address: text(form, "address"),
    storageTonnes: num(form, "storageTonnes"),
    hours: text(form, "hours"),
    delivers: form.get("delivers") === "1",
    notes: text(form, "notes"),
  };
  let siteId: string;
  try {
    siteId = id ? (await updateSite(user, id, fields)).id : (await createSite(user, fields)).id;
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath("/hub", "layout");
  redirect(`/hub/gas/sites/${siteId}?saved=1`);
}

export async function confirmSiteAction(form: FormData) {
  const user = await requireUser();
  await confirmSite(user, text(form, "id")).catch(message);
  revalidatePath("/hub", "layout");
}

// ---- Price board, delivery jobs and supply agreements ----

export async function reportPricesAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const prices: Record<string, number | null> = {};
  for (const [k, v] of form.entries()) if (k.startsWith("price:")) prices[k.slice(6)] = String(v).trim() === "" ? null : Number(String(v).replace(/,/g, ""));
  try {
    const n = await reportPrices(user, { state: text(form, "state"), daysAgo: Number(text(form, "daysAgo") || 0), prices });
    revalidatePath("/hub/prices");
    return { ok: `${n} price${n === 1 ? "" : "s"} recorded. Thank you; the board shows medians across sellers, never your individual price.` };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function postJobAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  let id: string;
  try {
    id = (await postJob(user, {
      title: text(form, "title"), products: form.getAll("products").map(String), quantity: num(form, "quantity") ?? NaN, unit: text(form, "unit") as never,
      fromState: text(form, "fromState"), fromTown: text(form, "fromTown"), toState: text(form, "toState"), toTown: text(form, "toTown"),
      pickupDate: new Date(text(form, "pickupDate") || NaN), details: text(form, "details"),
    })).id;
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath("/hub/jobs");
  redirect(`/hub/jobs/${id}`);
}

export async function quoteAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const jobId = text(form, "jobId");
  try {
    await submitQuote(user, jobId, { priceNaira: num(form, "priceNaira") ?? NaN, note: text(form, "note") });
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath(`/hub/jobs/${jobId}`);
  return { ok: "Quote sent. The business will see it with the others and can accept it." };
}

async function jobStep(form: FormData, fn: (user: Awaited<ReturnType<typeof requireUser>>, jobId: string) => Promise<unknown>) {
  const user = await requireUser();
  const jobId = text(form, "jobId");
  await fn(user, jobId).catch(message);
  revalidatePath(`/hub/jobs/${jobId}`);
  revalidatePath("/hub/jobs");
}
export async function acceptQuoteAction(form: FormData) {
  await jobStep(form, (u, id) => acceptQuote(u, id, text(form, "quoteId")));
}
export async function withdrawQuoteAction(form: FormData) {
  await jobStep(form, withdrawQuote);
}
export async function cancelJobAction(form: FormData) {
  await jobStep(form, cancelJob);
}
export async function confirmJobAction(form: FormData) {
  await jobStep(form, confirmDelivered);
}

export async function proposeAgreementAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  let id: string;
  try {
    id = (await proposeAgreement(user, {
      counterpartyId: text(form, "counterpartyId"), side: text(form, "side") as never, product: text(form, "product") as never, quantity: num(form, "quantity") ?? NaN,
      unit: text(form, "unit") as never, frequency: text(form, "frequency") as never, deliverTo: text(form, "deliverTo"), priceNote: text(form, "priceNote"), notes: text(form, "notes"),
      startDate: new Date(text(form, "startDate") || NaN), endDate: text(form, "endDate") ? new Date(text(form, "endDate")) : null,
    })).id;
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath("/hub/supply");
  redirect(`/hub/supply/${id}`);
}

async function supplyStep(form: FormData, fn: (user: Awaited<ReturnType<typeof requireUser>>, id: string) => Promise<unknown>) {
  const user = await requireUser();
  const id = text(form, "agreementId");
  await fn(user, id).catch(message);
  revalidatePath(`/hub/supply/${id}`);
  revalidatePath("/hub/supply");
}
export async function respondAgreementAction(form: FormData) {
  await supplyStep(form, (u, id) => respond(u, id, text(form, "accept") === "1"));
}
export async function agreementStatusAction(form: FormData) {
  await supplyStep(form, (u, id) => setStatus(u, id, text(form, "status") as never));
}

export async function logDeliveryAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = text(form, "agreementId");
  try {
    await logDelivery(user, id, { deliveredOn: new Date(text(form, "deliveredOn") || NaN), quantity: num(form, "quantity") ?? NaN });
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath(`/hub/supply/${id}`);
  return { ok: "Delivery logged. The buyer has been asked to confirm it." };
}

export async function reviewDeliveryAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  try {
    await reviewDelivery(user, text(form, "deliveryId"), text(form, "ok") === "1", text(form, "note"));
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath(`/hub/supply/${text(form, "agreementId")}`);
  return { ok: "Saved." };
}

export async function startBusinessCheckoutAction(): Promise<ActionState> {
  const user = await requireUser();
  let url: string;
  try {
    url = await startBusinessCheckout(user);
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    console.error("business checkout", e);
    return { error: "The payment page could not be opened. Try again in a minute." };
  }
  redirect(url);
}

/** For payments taken outside the app (bank transfer): an administrator adds 30 days to a business's plan. */
export async function grantBusinessPlanAction(form: FormData) {
  const admin = await requireRole("ADMIN");
  const id = text(form, "businessId");
  await extendBusinessPlan(id, BUSINESS_PLAN_DAYS);
  await audit(admin.id, "hub.business.grant_plan", "HubBusiness", id, { days: BUSINESS_PLAN_DAYS });
  revalidatePath("/admin/hub");
  revalidatePath("/hub", "layout");
}
