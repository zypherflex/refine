import Link from "next/link";
import { requireUser } from "@/server/auth";
import { deliverySellers } from "@/server/everyday/orders";
import { db } from "@/lib/db";
import { NIGERIAN_STATES } from "@/lib/hub/catalog";
import { EmptyState, Notice, PageHeader } from "@/components/ui";
import { OrderForm } from "@/components/everyday/forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order a gas refill" };

export default async function OrderPage({ searchParams }: { searchParams: Promise<{ state?: string; seller?: string }> }) {
  const user = await requireUser("/order");
  const sp = await searchParams;
  const state = (NIGERIAN_STATES as readonly string[]).includes(sp.state ?? "") ? sp.state! : user.homeState ?? "Lagos";
  const [sellers, me] = await Promise.all([deliverySellers(state), db.user.findUnique({ where: { id: user.id }, select: { phone: true } })]);
  return (
    <>
      <PageHeader eyebrow="Everyday" title="Order a gas refill" subtitle="From sellers RefineryLens has verified, delivered to your door. You pay the rider when the gas arrives." />
      <form action="/order" className="mb-5 flex flex-wrap items-center gap-2">
        <label htmlFor="o-state" className="text-sm font-medium">Deliver in</label>
        <select id="o-state" name="state" defaultValue={state} className="input w-auto">{NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}</select>
        <button className="btn-secondary btn-sm">Change</button>
      </form>
      {sellers.length === 0 ? (
        <EmptyState title={`No verified sellers deliver in ${state} yet`} action={<Link href={`/stations?state=${encodeURIComponent(state)}&kind=GAS_RETAILER`} className="btn-secondary btn-sm no-underline">Find a gas shop near you</Link>}>
          We are adding sellers state by state. Gas businesses can <Link href="/hub/orders">turn on home delivery</Link> from the business hub.
        </EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="card"><OrderForm sellers={sellers} state={state} phone={me?.phone ?? ""} defaultSeller={sp.seller} /></div>
          <aside className="space-y-3">
            <Notice title="Stay safe">Check the seal on the cylinder valve when it arrives, and that the weight matches what you paid for. Never pay before delivery.</Notice>
            <Notice title="Your details">Your address and phone are shared only with the seller you choose, so the rider can find you.</Notice>
          </aside>
        </div>
      )}
    </>
  );
}
