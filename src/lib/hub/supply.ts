/** Labels shared by the supply agreement pages. */
export const agreementStatus = { PROPOSED: "Waiting for a reply", ACTIVE: "Active", PAUSED: "Paused", ENDED: "Ended", DECLINED: "Declined" } as const;
export const agreementStyle = { PROPOSED: "bg-amber-100 text-amber-800", ACTIVE: "bg-brand-100 text-brand-800", PAUSED: "bg-ink-100 text-ink-800", ENDED: "bg-ink-50 text-ink-600", DECLINED: "bg-ink-50 text-ink-500" } as const;
export const every = { WEEKLY: "every week", FORTNIGHTLY: "every two weeks", MONTHLY: "every month" } as const;
