"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireRole, requireUser } from "@/server/auth";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { NIGERIAN_STATES } from "@/lib/hub/catalog";
import { addOutlet, reportOutlet } from "@/server/everyday/outlets";
import { advanceOrder, cancelOrder, placeOrder, rateOrder, saveHomeDelivery } from "@/server/everyday/orders";
import { addCylinder, deleteCylinder, logRefill, setReminder } from "@/server/everyday/cylinders";
import { flagContent, resolveFlags, setReportingBlocked, type Resolution } from "@/server/everyday/moderation";
import { startOrderPayment, startSellerFeesPayment } from "@/server/everyday/money";

export type ActionState = { error?: string | null; ok?: string | null };

function message(e: unknown): string {
  if (e instanceof ZodError) return e.issues.map((i) => i.message).join(" ");
  if (e instanceof AppError) return e.message;
  throw e;
}

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const num = (form: FormData, key: string) => {
  const v = text(form, key).replace(/[,₦\s]/g, "");
  return v === "" ? null : Number(v);
};
const date = (form: FormData, key: string) => {
  const v = text(form, key);
  return v ? new Date(`${v}T12:00:00Z`) : null;
};

export async function addOutletAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  let id: string;
  try {
    const o = await addOutlet(user, { name: text(form, "name"), brand: text(form, "brand"), kind: text(form, "kind") as never, state: text(form, "state"), area: text(form, "area"), address: text(form, "address") });
    id = o.id;
  } catch (e) {
    return { error: message(e) };
  }
  redirect(`/stations/${id}?added=1`);
}

export async function reportOutletAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const outletId = text(form, "outletId");
  const kind = text(form, "kind");
  try {
    if (kind === "PRICE") await reportOutlet(user, outletId, { kind, item: text(form, "item") as never, priceNaira: num(form, "price") ?? NaN, note: text(form, "note") });
    else if (kind === "AVAILABILITY") {
      const available = text(form, "available") === "yes";
      await reportOutlet(user, outletId, { kind, item: text(form, "item") as never, available, queue: available ? text(form, "queue") || null : null, note: text(form, "note") });
    } else await reportOutlet(user, outletId, { kind: "PROBLEM", problem: text(form, "problem"), note: text(form, "note") });
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath(`/stations/${outletId}`);
  return { ok: "Thank you. Your report helps everyone nearby." };
}

export async function setHomeStateAction(form: FormData) {
  const user = await requireUser();
  const s = text(form, "state");
  if ((NIGERIAN_STATES as readonly string[]).includes(s)) await db.user.update({ where: { id: user.id }, data: { homeState: s } });
  redirect("/today");
}

export async function placeOrderAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  let id: string;
  try {
    const o = await placeOrder(user, {
      businessId: text(form, "businessId"),
      cylinderKg: num(form, "cylinderKg") ?? NaN,
      cylinders: num(form, "cylinders") ?? 1,
      state: text(form, "state"),
      area: text(form, "area"),
      address: text(form, "address"),
      phone: text(form, "phone"),
      note: text(form, "note"),
      recipientName: form.get("forSomeoneElse") === "on" ? text(form, "recipientName") : "",
    });
    id = o.id;
  } catch (e) {
    return { error: message(e) };
  }
  redirect(`/orders/${id}?placed=1`);
}

export async function cancelOrderAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  try {
    await cancelOrder(user, text(form, "orderId"));
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath(`/orders/${text(form, "orderId")}`);
  return { ok: "Order cancelled." };
}

export async function rateOrderAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  try {
    await rateOrder(user, text(form, "orderId"), num(form, "rating") ?? 0);
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath(`/orders/${text(form, "orderId")}`);
  return { ok: "Thanks for rating." };
}

export async function advanceOrderAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const step = text(form, "step") as "accept" | "decline" | "dispatch" | "deliver";
  try {
    await advanceOrder(user, text(form, "orderId"), step, { priceNaira: num(form, "price"), note: text(form, "note") });
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath("/hub/orders");
  return { ok: { accept: "Accepted. The customer has been told the price.", decline: "Declined.", dispatch: "Marked as on the way.", deliver: "Marked as delivered." }[step] ?? "Saved." };
}

export async function saveHomeDeliveryAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  try {
    await saveHomeDelivery(user, {
      homeDelivery: form.get("homeDelivery") === "on",
      deliveryStates: form.getAll("deliveryStates").map(String),
      homePricePerKg: num(form, "homePricePerKg"),
      deliveryFeeNaira: num(form, "deliveryFeeNaira"),
    });
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath("/hub/orders");
  return { ok: "Home delivery settings saved." };
}

export async function addCylinderAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  try {
    await addCylinder(user, { label: text(form, "label") || "Kitchen", sizeKg: num(form, "sizeKg") ?? NaN, usualDays: num(form, "usualDays") ?? 30, lastFilledAt: date(form, "lastFilledAt") });
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath("/my-gas");
  return { ok: "Cylinder added." };
}

export async function logRefillAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  try {
    await logRefill(user, text(form, "cylinderId"), { filledAt: date(form, "filledAt") ?? new Date(), priceNaira: num(form, "price") });
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath("/my-gas");
  return { ok: "Refill logged." };
}

export async function setReminderAction(form: FormData) {
  const user = await requireUser();
  await setReminder(user, text(form, "cylinderId"), text(form, "remind") === "on");
  revalidatePath("/my-gas");
}

export async function deleteCylinderAction(form: FormData) {
  const user = await requireUser();
  await deleteCylinder(user, text(form, "cylinderId"));
  revalidatePath("/my-gas");
}

export async function flagContentAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  try {
    await flagContent(user, { target: text(form, "target") as "REPORT", id: text(form, "id"), reason: text(form, "reason"), note: text(form, "note") });
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath(`/stations/${text(form, "outletId")}`);
  return { ok: "Thanks. An administrator will review it." };
}

export async function resolveFlagsAction(form: FormData) {
  const admin = await requireRole("ADMIN");
  await resolveFlags(admin, text(form, "target") as "REPORT" | "OUTLET", text(form, "id"), text(form, "resolution") as Resolution);
  revalidatePath("/admin/everyday");
}

export async function setReportingBlockedAction(form: FormData) {
  const admin = await requireRole("ADMIN");
  await setReportingBlocked(admin, text(form, "userId"), text(form, "blocked") === "yes");
  revalidatePath("/admin/everyday");
  revalidatePath(`/admin/users/${text(form, "userId")}`);
}

export async function payOrderAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  let url: string;
  try {
    url = await startOrderPayment(user, text(form, "orderId"), text(form, "currency") === "USD" ? "USD" : "NGN");
  } catch (e) {
    return { error: message(e) };
  }
  redirect(url);
}

export async function paySellerFeesAction(_: ActionState): Promise<ActionState> {
  const user = await requireUser();
  let url: string;
  try {
    url = await startSellerFeesPayment(user);
  } catch (e) {
    return { error: message(e) };
  }
  redirect(url);
}
