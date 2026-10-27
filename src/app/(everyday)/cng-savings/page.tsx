import Link from "next/link";
import { getCurrentUser } from "@/server/auth";
import { fuelPricesFor } from "@/server/everyday/outlets";
import { PageHeader, Notice } from "@/components/ui";
import { CngCalculator } from "@/components/everyday/forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "CNG savings calculator", description: "How much you could save each month by converting your car, bus or keke to CNG, and how fast the conversion pays back." };

export default async function CngSavingsPage() {
  const user = await getCurrentUser();
  const local = await fuelPricesFor(user?.homeState ?? null);
  const national = local.petrol && local.cng ? local : await fuelPricesFor(null);
  return (
    <>
      <PageHeader eyebrow="Everyday" title="Should I convert to CNG?" subtitle="Put in how you drive and today's prices. See what a month costs on petrol and on CNG, and how quickly a conversion pays for itself." />
      <CngCalculator petrol={local.petrol ?? national.petrol} cng={local.cng ?? national.cng} />
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <Notice title="Before you convert">Use a conversion centre certified under the government&apos;s CNG programme, ask for the cylinder&apos;s test certificate, and check there is a CNG station on the routes you drive. <Link href="/stations?kind=CNG_STATION">Find CNG stations</Link>.</Notice>
        <Notice title="Keep both fuels">Most conversions are dual-fuel: the vehicle still runs on petrol when you cannot find CNG.</Notice>
      </div>
    </>
  );
}
