/** Plan definitions. Prices are intentionally not shown until a payment provider and pricing are configured. */
export const PLANS = [
  { id: "FREE", name: "Free", tagline: "Follow one company and learn the basics.", features: ["Reviewed announcement feed", "Financial and operating metrics with sources", "One private thesis", "10 assistant questions per day"], limits: { theses: 1, privateDocs: 3, assistantPerDay: 10 } },
  { id: "PRO", name: "Pro", tagline: "For investors tracking a thesis in depth.", features: ["Everything in Free", "Unlimited theses and version history", "Private document uploads", "Higher assistant limits", "Daily and weekly digests"], limits: { theses: 50, privateDocs: 100, assistantPerDay: 200 } },
  { id: "TEAM", name: "Team", tagline: "For analysts and investment teams.", features: ["Everything in Pro", "Shared team workspace", "Analyst and editor roles", "Audit log access"], limits: { theses: 500, privateDocs: 1000, assistantPerDay: 1000 } },
] as const;
