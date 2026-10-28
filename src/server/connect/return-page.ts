import { db } from "@/lib/db";

/** Where a customer lands after paying, by what the payment was for. */
export async function returnPage(reference: string, purpose?: string) {
  const p = purpose ? null : await db.payment.findUnique({ where: { reference }, select: { purpose: true } }).catch(() => null);
  switch (purpose ?? p?.purpose) {
    case "BUSINESS_PLAN": return "/hub/me";
    case "DATA_PLAN": return "/account/data";
    case "SELLER_FEES": return "/hub/orders";
    case "GAS_ORDER": {
      const pay = await db.payment.findUnique({ where: { reference }, select: { gasOrderId: true } }).catch(() => null);
      return pay?.gasOrderId ? `/orders/${pay.gasOrderId}` : "/my-gas";
    }
    default: return "/settings";
  }
}
