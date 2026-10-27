import { requireUser } from "@/server/auth";
import { NIGERIAN_STATES } from "@/lib/hub/catalog";
import { PageHeader } from "@/components/ui";
import { OutletForm } from "@/components/everyday/forms";

export const metadata = { title: "Add a place" };

export default async function NewStationPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const user = await requireUser("/stations/new");
  const { state } = await searchParams;
  const s = (NIGERIAN_STATES as readonly string[]).includes(state ?? "") ? state! : user.homeState ?? "Lagos";
  return (
    <>
      <PageHeader eyebrow="Everyday" title="Add a station or gas shop" subtitle="Add places you buy from so you and your neighbours can report prices there. Check it is not already listed first." />
      <div className="card max-w-2xl"><OutletForm defaultState={s} /></div>
    </>
  );
}
