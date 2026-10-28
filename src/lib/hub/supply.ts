/** Labels shared by the supply agreement pages. */
export const agreementStatus = { PROPOSED: "Waiting for a reply", ACTIVE: "Active", PAUSED: "Paused", ENDED: "Ended", DECLINED: "Declined" } as const;
export const agreementStyle = { PROPOSED: "bg-amber-100 text-amber-800", ACTIVE: "bg-brand-100 text-brand-800", PAUSED: "bg-navy-100 text-navy-800", ENDED: "bg-navy-50 text-navy-600", DECLINED: "bg-navy-50 text-navy-500" } as const;
export const every = { WEEKLY: "every week", FORTNIGHTLY: "every two weeks", MONTHLY: "every month" } as const;
