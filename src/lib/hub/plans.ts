/**
 * RefineryLens revenue lines (strategy section 06). "Now" lines can register interest today; payments are not collected
 * until a payment provider is configured. "Partner" lines need a licensed partner and are shown as coming soon only.
 */
export type LineWhen = "NOW" | "NEXT" | "PARTNER";

export const REVENUE_LINES = [
  {
    id: "verified-business",
    when: "NOW" as LineWhen,
    title: "Verified Business",
    who: "Sellers, hauliers and refineries",
    summary: "Verification, priority in search and listings, more listings and sites, and enquiry analytics. Set up by the RefineryLens team while online payment is not switched on.",
    features: ["Verified badge after a document check and field visit", "Listed first in the directory and offers", "Up to 100 listings, 200 sites and 200 messages a day", "Enquiry analytics for the last 30 days", "Team seats (coming)"],
  },
  {
    id: "price-intelligence",
    when: "NOW" as LineWhen,
    title: "Price intelligence",
    who: "Banks, manufacturers and traders",
    summary: "The daily price board, morning price alerts and 8 weeks of history stay free. Price data adds two years of weekly medians, CSV exports and a JSON API, set up by the team while online payment is off.",
    features: ["Two years of weekly medians by product and state", "CSV exports", "JSON API with keys for credit and procurement teams", "Threshold alerts (coming)"],
  },
  {
    id: "procurement-desk",
    when: "NOW" as LineWhen,
    title: "Industrial procurement desk",
    who: "Factories and fleets",
    summary: "Monthly diesel, LPG and CNG sourced from verified suppliers under recurring agreements, for a fee or a small margin.",
    features: ["A named desk contact", "Quotes from verified suppliers only", "Recurring supply agreements with confirmed deliveries", "Monthly spend and delivery report"],
  },
  {
    id: "research-pro",
    when: "NOW" as LineWhen,
    title: "Research and Pro",
    who: "Investors, analysts and lenders",
    summary: "The research layer: announcements, metrics, theses and the research assistant, with higher limits.",
    features: ["Unlimited theses and version history", "Private document uploads", "Higher assistant limits", "Daily and weekly digests"],
  },
  {
    id: "featured-listings",
    when: "NOW" as LineWhen,
    title: "Featured listings and quotes",
    who: "Sellers and hauliers",
    summary: "Appear first on a state, product or delivery job. Always labelled as promoted.",
    features: ["Top placement for a state or product", "Labelled “Promoted” wherever it shows", "Never changes verification or prices"],
  },
  {
    id: "compliance-vault",
    when: "NOW" as LineWhen,
    title: "Compliance vault",
    who: "Any business with licences to keep current",
    summary: "Licence and certificate storage with renewal reminders and a vendor pack for buyers' supplier checks. Free while in pilot.",
    features: ["Private scans of licences, permits and certificates", "Reminders 60, 30 and 7 days before expiry", "One-click vendor pack PDF", "You choose what the pack lists"],
  },
  {
    id: "escrow",
    when: "PARTNER" as LineWhen,
    title: "Escrow and payments",
    who: "Buyers and sellers who have not traded before",
    summary: "Buyer pays into escrow through a licensed payment provider; funds release when both sides confirm delivery.",
    features: [],
  },
  {
    id: "trade-finance",
    when: "PARTNER" as LineWhen,
    title: "Inventory and trade finance",
    who: "Kiosks, stations and refill plants",
    summary: "Licensed lenders finance stock, using confirmed delivery records on RefineryLens as the credit signal. A pilot is open: verified businesses can share their record with a lender under Stock finance.",
    features: [],
  },
  {
    id: "transit-insurance",
    when: "PARTNER" as LineWhen,
    title: "Insurance in transit",
    who: "Delivery jobs",
    summary: "Cargo and liability cover for delivery jobs, sold through a licensed insurer at booking.",
    features: [],
  },
] as const;

export const WHEN_LABEL: Record<LineWhen, string> = { NOW: "Now", NEXT: "Next", PARTNER: "Needs a licensed partner" };
