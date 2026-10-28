import { describe, expect, it } from "vitest";
import { can, hasRole } from "@/lib/permissions";

const u = (role: any, id = "u1") => ({ id, role });

describe("role-based access", () => {
  it("ranks roles", () => {
    expect(hasRole(u("ADMIN"), "EDITOR")).toBe(true);
    expect(hasRole(u("USER"), "ANALYST")).toBe(false);
    expect(hasRole(null, "USER")).toBe(false);
  });
  it("only admins manage people and moderate the trade hub", () => {
    expect(can.manageUsers(u("EDITOR"))).toBe(false);
    expect(can.manageUsers(u("ADMIN"))).toBe(true);
    expect(can.moderateHub(u("USER"))).toBe(false);
    expect(can.moderateHub(u("ADMIN"))).toBe(true);
  });
  it("only staff see market data from sources awaiting approval", () => {
    expect(can.viewEditorial(u("USER"))).toBe(false);
    expect(can.viewEditorial(u("ANALYST"))).toBe(true);
  });
});
