import { describe, expect, it } from "vitest";
import { can, canAccessDocument, canAccessThesis, canViewPublication } from "@/lib/permissions";
import { classify, enforceCitations } from "@/server/assistant/engine";

const u = (role: any, id = "u1") => ({ id, role });

describe("role-based access", () => {
  it("only editors and admins publish", () => {
    expect(can.publish(u("USER"))).toBe(false);
    expect(can.publish(u("ANALYST"))).toBe(false);
    expect(can.publish(u("EDITOR"))).toBe(true);
    expect(can.publish(u("ADMIN"))).toBe(true);
    expect(can.draftContent(u("ANALYST"))).toBe(true);
    expect(can.draftContent(u("USER"))).toBe(false);
    expect(can.manageUsers(u("EDITOR"))).toBe(false);
  });
  it("readers see published, retracted and superseded items but not drafts", () => {
    expect(canViewPublication(u("USER"), "PUBLISHED")).toBe(true);
    expect(canViewPublication(u("USER"), "RETRACTED")).toBe(true);
    expect(canViewPublication(u("USER"), "DRAFT")).toBe(false);
    expect(canViewPublication(u("USER"), "IN_REVIEW")).toBe(false);
    expect(canViewPublication(null, "DRAFT")).toBe(false);
    expect(canViewPublication(u("ANALYST"), "IN_REVIEW")).toBe(true);
  });
  it("private documents are visible only to their owner, never to admins", () => {
    const doc = { visibility: "PRIVATE" as const, ownerId: "owner", status: "EXTRACTED" };
    expect(canAccessDocument(u("USER", "owner"), doc)).toBe(true);
    expect(canAccessDocument(u("USER", "other"), doc)).toBe(false);
    expect(canAccessDocument(u("ADMIN", "admin"), doc)).toBe(false);
    expect(canAccessDocument(null, doc)).toBe(false);
  });
  it("unapproved public documents are staff-only", () => {
    const doc = { visibility: "PUBLIC" as const, ownerId: null, status: "EXTRACTED" };
    expect(canAccessDocument(u("USER"), doc)).toBe(false);
    expect(canAccessDocument(u("ANALYST"), doc)).toBe(true);
    expect(canAccessDocument(u("USER"), { ...doc, status: "APPROVED" })).toBe(true);
  });
  it("theses are private to their owner", () => {
    expect(canAccessThesis(u("USER", "a"), { ownerId: "a" })).toBe(true);
    expect(canAccessThesis(u("ADMIN", "b"), { ownerId: "a" })).toBe(false);
  });
});

describe("assistant guards", () => {
  it("drops claims that cite unknown sources", () => {
    const out = enforceCitations({ evidence: [{ claim: "a", kind: "FACT", refs: ["S1"] }, { claim: "invented", kind: "FACT", refs: ["S99"] }, { claim: "mixed", kind: "FACT", refs: ["S1", "S77"] }] }, new Set(["S1"]));
    expect(out.evidence.map((e) => e.claim)).toEqual(["a", "mixed"]);
    expect(out.evidence[1].refs).toEqual(["S1"]);
    expect(out.dropped).toBe(1);
  });
  it("classifies the core question types", () => {
    expect(classify("What changed this month?")).toBe("WHAT_CHANGED");
    expect(classify("Explain this report in simple language.")).toBe("EXPLAIN_REPORT");
    expect(classify("Why can higher fuel prices fail to increase profit?")).toBe("GENERAL");
    expect(classify("Which disclosures challenge my saved thesis?")).toBe("THESIS_CHALLENGE");
    expect(classify("What information is missing from this analysis?")).toBe("MISSING");
  });
});
