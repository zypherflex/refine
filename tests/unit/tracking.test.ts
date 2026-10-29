import { describe, expect, it } from "vitest";
import { distanceKm, etaMinutes, fmtEta, isValidPosition, thinTrail } from "@/lib/tracking";

describe("tracking maths", () => {
  it("measures straight-line distance", () => {
    // Lagos (Ikeja) to Abuja is roughly 525 km as the crow flies.
    expect(distanceKm({ lat: 6.6, lon: 3.35 }, { lat: 9.06, lon: 7.49 })).toBeGreaterThan(500);
    expect(distanceKm({ lat: 6.6, lon: 3.35 }, { lat: 9.06, lon: 7.49 })).toBeLessThan(560);
    expect(distanceKm({ lat: 6.5, lon: 3.3 }, { lat: 6.5, lon: 3.3 })).toBe(0);
  });

  it("estimates arrival from recent moving speed, or a typical speed when stopped", () => {
    // 10 km straight line = 13 km by road; at 36 km/h (10 m/s) that is about 22 minutes.
    expect(etaMinutes(10, [10, 10, 10], "GAS_ORDER")).toBe(22);
    // Stopped in traffic: typical 20 km/h in town, 45 km/h for trucks.
    expect(etaMinutes(10, [0, 0, null], "GAS_ORDER")).toBe(39);
    expect(etaMinutes(10, [], "DELIVERY_JOB")).toBe(17);
    expect(etaMinutes(0.01, [], "GAS_ORDER")).toBe(1);
  });

  it("thins long trails but keeps the ends", () => {
    const pts = Array.from({ length: 1000 }, (_, i) => i);
    const t = thinTrail(pts, 100);
    expect(t).toHaveLength(100);
    expect(t[0]).toBe(0);
    expect(t.at(-1)).toBe(999);
    expect(thinTrail([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("formats arrival times and rejects impossible positions", () => {
    expect(fmtEta(12)).toBe("about 12 min");
    expect(fmtEta(135)).toBe("about 2 h 15 min");
    expect(isValidPosition({ lat: 91, lon: 0 })).toBe(false);
    expect(isValidPosition({ lat: NaN, lon: 0 })).toBe(false);
    expect(isValidPosition({ lat: 6.5, lon: 3.3 })).toBe(true);
  });
});
