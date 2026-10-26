import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { boardItem, listScenarios } from "@/server/opportunities/board";
import { buildBrief } from "@/server/opportunities/brief";
import { opportunityBySlug } from "@/lib/opportunities/catalog";

/** A brief only ever includes the signed-in user's own readiness answers and scenarios. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  const o = opportunityBySlug((await params).slug);
  if (!user || !o) return new NextResponse("Not found", { status: 404 });
  const scenarioId = new URL(req.url).searchParams.get("scenario");
  const [item, scenarios] = await Promise.all([boardItem(user, o.slug), scenarioId ? listScenarios(user, { opportunitySlug: o.slug }) : Promise.resolve([])]);
  const scenario = scenarioId ? scenarios.find((s) => s.id === scenarioId) ?? null : null;
  if (scenarioId && !scenario) return new NextResponse("Not found", { status: 404 });
  const bytes = await buildBrief(o, { userName: user.name, checked: item?.checked ?? [], scenario });
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="refinerylens-${o.slug}-brief.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
