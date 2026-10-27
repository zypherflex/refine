import { describe, expect, it } from "vitest";
import { displayName, isProtectedName, median } from "@/lib/hub/rules";
import { STATES } from "@/lib/hub/catalog";
import { stateStatus } from "@/server/hub/gas";

describe("trade hub rules", () => {
  it("takes the median of odd and even sets", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1400, 1300, 1350, 1330])).toBe(1340);
  });

  it("hides well-known names until a business is verified", () => {
    expect(isProtectedName("Dangote LPG Partners")).toBe(true);
    expect(isProtectedName("NNPC mega station agent")).toBe(true);
    expect(isProtectedName("Ikeja Gas Hub")).toBe(false);
    expect(isProtectedName("Seven Energy")).toBe(false); // "eni" only as a whole word
    expect(displayName({ name: "Dangote Gas Depot", verification: "UNVERIFIED" })).toBe("Name hidden until verified");
    expect(displayName({ name: "Dangote Gas Depot", verification: "PENDING" })).toBe("Name hidden until verified");
    expect(displayName({ name: "Dangote Gas Depot", verification: "VERIFIED" })).toBe("Dangote Gas Depot");
  });

  it("lists all 36 states and the FCT, each in its own map cell", () => {
    expect(STATES).toHaveLength(37);
    expect(new Set(STATES.map((s) => `${s.col},${s.row}`)).size).toBe(37);
  });

  it("marks a gap where there is demand and no supply", () => {
    expect(stateStatus({ supply: 1, delivery: 0, demand: 3 })).toBe("SERVED");
    expect(stateStatus({ supply: 0, delivery: 1, demand: 2 })).toBe("GAP");
    expect(stateStatus({ supply: 0, delivery: 1, demand: 0 })).toBe("DELIVERY_ONLY");
    expect(stateStatus({ supply: 0, delivery: 0, demand: 0 })).toBe("NO_DATA");
  });
});
