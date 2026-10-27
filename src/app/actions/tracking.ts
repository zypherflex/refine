"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireUser } from "@/server/auth";
import { AppError } from "@/lib/errors";
import { createDriverLink } from "@/server/tracking";

export type DriverLinkState = { error?: string | null; path?: string | null };

/** Seller or carrier creates (or replaces) the private link its driver opens to share their location. */
export async function createDriverLinkAction(_: DriverLinkState, form: FormData): Promise<DriverLinkState> {
  const user = await requireUser();
  const kind = form.get("kind") === "DELIVERY_JOB" ? "DELIVERY_JOB" : "GAS_ORDER";
  const id = String(form.get("id") ?? "");
  try {
    const { path } = await createDriverLink(user, { kind, id }, { driverName: String(form.get("driverName") ?? ""), driverPhone: String(form.get("driverPhone") ?? "") });
    revalidatePath(kind === "GAS_ORDER" ? "/hub/orders" : `/hub/jobs/${id}`);
    return { path };
  } catch (e) {
    if (e instanceof ZodError) return { error: e.issues.map((i) => i.message).join(" ") };
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
}
