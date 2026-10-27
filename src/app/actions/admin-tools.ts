"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireRole } from "@/server/auth";
import { AppError } from "@/lib/errors";
import { adminCancelJob, adminCloseListing } from "@/server/admin/hub";
import { adminCancelOrder, adminEndTrip, mergeOutlets, setOutletHidden, updateOutlet } from "@/server/admin/everyday";
import { hideOutletReport } from "@/server/everyday/outlets";

export type AdminState = { error?: string | null; ok?: string | null };

const s = (form: FormData, k: string) => String(form.get(k) ?? "").trim();
function message(e: unknown): string {
  if (e instanceof ZodError) return e.issues.map((i) => i.message).join(" ");
  if (e instanceof AppError) return e.message;
  throw e;
}

/** Runs an admin tool that needs a reason or input, and reports the outcome to the form. */
async function run(fn: () => Promise<unknown>, ok: string, paths: string[]): Promise<AdminState> {
  try {
    await fn();
  } catch (e) {
    return { error: message(e) };
  }
  for (const p of paths) revalidatePath(p);
  return { ok };
}

export async function closeListingAction(_: AdminState, form: FormData) {
  const admin = await requireRole("ADMIN");
  return run(() => adminCloseListing(admin, s(form, "id"), s(form, "reason")), "Listing taken down; the business was told.", ["/admin/listings"]);
}

export async function cancelJobAction(_: AdminState, form: FormData) {
  const admin = await requireRole("ADMIN");
  return run(() => adminCancelJob(admin, s(form, "id"), s(form, "reason")), "Job cancelled; both businesses were told.", ["/admin/jobs"]);
}

export async function cancelOrderAdminAction(_: AdminState, form: FormData) {
  const admin = await requireRole("ADMIN");
  return run(() => adminCancelOrder(admin, s(form, "id"), s(form, "reason")), "Order cancelled; the customer and seller were told.", ["/admin/orders"]);
}

export async function editOutletAction(_: AdminState, form: FormData) {
  const admin = await requireRole("ADMIN");
  return run(
    () => updateOutlet(admin, s(form, "id"), { name: s(form, "name"), brand: s(form, "brand"), kind: s(form, "kind") as never, area: s(form, "area"), address: s(form, "address") }),
    "Saved.",
    ["/admin/outlets"],
  );
}

export async function mergeOutletAction(_: AdminState, form: FormData) {
  const admin = await requireRole("ADMIN");
  let moved = 0;
  const res = await run(async () => { moved = await mergeOutlets(admin, s(form, "id"), s(form, "intoId")); }, "Merged.", ["/admin/outlets"]);
  return res.ok ? { ok: `Merged: ${moved} report${moved === 1 ? "" : "s"} moved, duplicate hidden.` } : res;
}

export async function toggleOutletAction(form: FormData) {
  const admin = await requireRole("ADMIN");
  await setOutletHidden(admin, s(form, "id"), s(form, "hidden") === "yes");
  revalidatePath("/admin/outlets");
}

export async function hidePriceReportAction(form: FormData) {
  const admin = await requireRole("ADMIN");
  await hideOutletReport(admin, s(form, "id"));
  revalidatePath("/admin/prices");
}

export async function endTripAction(form: FormData) {
  const admin = await requireRole("ADMIN");
  await adminEndTrip(admin, s(form, "id"));
  revalidatePath("/admin/trips");
}

export async function sendBroadcastAction(_: AdminState, form: FormData) {
  const admin = await requireRole("ADMIN");
  const { sendBroadcast } = await import("@/server/admin/broadcast");
  let n = 0;
  const res = await run(async () => {
    const b = await sendBroadcast(admin, { segment: s(form, "segment") as never, state: s(form, "state") || null, title: s(form, "title"), body: s(form, "body"), link: s(form, "link") || "/today", confirmCount: Number(s(form, "confirmCount")) });
    n = b.recipients;
  }, "Sent.", ["/admin/broadcast"]);
  return res.ok ? { ok: `Sent to ${n.toLocaleString("en-GB")} people.` } : res;
}

export async function retryJobsAction(form: FormData) {
  const admin = await requireRole("ADMIN");
  const { retryFailedJobs } = await import("@/server/admin/system");
  await retryFailedJobs(admin, s(form, "id") || undefined);
  revalidatePath("/admin/system");
}
