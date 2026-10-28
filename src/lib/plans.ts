/** Plans for people. Businesses buy the trade hub Business plan from their profile; data customers buy data plans. */
export const PLANS = [
  { id: "FREE", name: "Free", tagline: "Prices near you, gas orders and refill reminders.", features: ["Today's prices in every state", "Order cooking gas, paid on delivery", "Cylinder tracker and refill reminders", "Morning price digest by text"] },
  { id: "PRO", name: "RefineryLens Plus", tagline: "For households that pay online, and Nigerians abroad sending gas home.", features: ["Everything in Free", "No service fee when you pay for gas online", "Pay in naira or US dollars", "Plus badge on your orders, so sellers know you"] },
] as const;
