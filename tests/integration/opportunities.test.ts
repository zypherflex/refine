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
