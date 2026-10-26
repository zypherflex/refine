import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { deleteScenario, listBoard, listScenarios, saveBoardItem, saveScenario } from "@/server/opportunities/board";
import { resetDb, user } from "../helpers";

beforeEach(resetDb);

describe("opportunity board and scenarios", () => {
  it("keeps each user's board private and upserts per opportunity", async () => {
    const a = await user();
    const b = await user("ADMIN");
    await saveBoardItem(a, { slug: "lpg-retail", stage: "VALIDATING", notes: "Two quotes requested" });
    await saveBoardItem(a, { slug: "lpg-retail", stage: "PURSUING" });
    const mine = await listBoard(a);
    expect(mine).toHaveLength(1);
    expect(mine[0].stage).toBe("PURSUING");
    expect(await listBoard(b)).toHaveLength(0);
  });

  it("rejects unknown opportunities and tools", async () => {
    const a = await user();
    await expect(saveBoardItem(a, { slug: "not-real" })).rejects.toThrow(/not found/i);
    await expect(saveScenario(a, { calculatorId: "nope", name: "x scenario", inputs: { a: 1 } })).rejects.toThrow();
  });

  it("stores only the tool's own inputs and cannot be deleted by someone else", async () => {
    const a = await user();
    const b = await user();
    const s = await saveScenario(a, { calculatorId: "unit-margin", opportunitySlug: "lpg-retail", name: "Cautious case", inputs: { volumePerDay: 500, sellPrice: 1200, injected: 99 } });
    expect(Object.keys(s.inputs as object).sort()).toEqual(["sellPrice", "volumePerDay"]);
    expect(await listScenarios(b)).toHaveLength(0);
    await expect(deleteScenario(b, s.id)).rejects.toThrow(/not found/i);
    await deleteScenario(a, s.id);
    expect(await db.opportunityScenario.count()).toBe(0);
  });
});

describe("readiness, business profile and brief", () => {
  it("ticks only the opportunity's own questions and keeps them private", async () => {
    const { setReadiness, readiness, boardItem } = await import("@/server/opportunities/board");
    const { opportunityBySlug } = await import("@/lib/opportunities/catalog");
    const a = await user();
    const b = await user();
    const q = opportunityBySlug("lpg-retail")!.validate[0];
    await setReadiness(a, "lpg-retail", q, true);
    await expect(setReadiness(a, "lpg-retail", "Made-up question", true)).rejects.toThrow(/not found/i);
    const item = await boardItem(a, "lpg-retail");
    expect(readiness("lpg-retail", item!.checked)).toMatchObject({ done: 1, total: 3 });
    expect(await boardItem(b, "lpg-retail")).toBeNull();
    await setReadiness(a, "lpg-retail", q, false);
    expect((await boardItem(a, "lpg-retail"))!.checked).toEqual([]);
  });

  it("validates and saves a business profile", async () => {
    const { saveProfile, getProfile } = await import("@/server/opportunities/board");
    const a = await user();
    await expect(saveProfile(a, { scale: "huge" })).rejects.toThrow();
    await saveProfile(a, { scale: "small", segments: ["gas", "gas"], assets: ["trucks"] });
    expect(await getProfile(a)).toMatchObject({ scale: "small", segments: ["gas"], assets: ["trucks"] });
  });

  it("builds a PDF brief with the scenario, sources and disclaimer", async () => {
    const { buildBrief, pdfSafe } = await import("@/server/opportunities/brief");
    const { opportunityBySlug } = await import("@/lib/opportunities/catalog");
    const { exampleInputs } = await import("@/lib/opportunities/calculators");
    const o = opportunityBySlug("modular-refining")!;
    const bytes = await buildBrief(o, { userName: "Test User", checked: [o.validate[0]], scenario: { name: "Base case", inputs: exampleInputs("modular-refinery"), createdAt: new Date() } });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(3000);
    expect(pdfSafe("Σ yield × price − cost “q”")).toBe('sum of yield x price - cost "q"');
  });
});
