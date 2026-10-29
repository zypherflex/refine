"use client";
import { usePathname } from "next/navigation";

/** Research pages are about one company at a time; the switcher and its notice only appear there. */
const RESEARCH = ["/dashboard", "/company", "/announcements", "/financials", "/operations", "/risks", "/market", "/refineries", "/thesis", "/assistant", "/watchlist", "/library", "/corrections", "/documents", "/editorial"];

export function useIsResearch() {
  const path = usePathname();
  return RESEARCH.some((r) => path === r || path.startsWith(r + "/"));
}

export function ResearchOnly({ children }: { children: React.ReactNode }) {
  return useIsResearch() ? <>{children}</> : null;
}
