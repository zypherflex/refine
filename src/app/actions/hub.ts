"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireRole, requireUser } from "@/server/auth";
import { requestVerification, saveBusiness } from "@/server/hub/business";
import { closeListing, createListing, renewListing, updateListing } from "@/server/hub/listings";
import { reply, sendEnquiry } from "@/server/hub/messages";
import { closeReport, decideVerification, reinstateBusiness, reportBusiness, suspendBusiness } from "@/server/hub/moderation";
import { AppError } from "@/lib/errors";

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
