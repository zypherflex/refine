/**
 * Educational explanations that are not about any specific company. The assistant labels these
 * "General explanation" so they are never mistaken for company-specific conclusions.
 */
export const GENERAL_EXPLANATIONS: { id: string; match: RegExp; title: string; text: string }[] = [
  {
    id: "fuel-prices-profit",
    match: /(fuel|petrol|diesel|pump|product|oil|crude)\s*prices?.*(profit|earn|margin|cash)|(profit|earn).*(fuel|oil|crude)\s*prices?/i,
    title: "Why higher fuel prices do not automatically raise a refiner's profit",
    text:
      "A refiner earns the difference between what it sells products for and what it pays for crude oil and running costs. When fuel prices rise because crude prices rose, that difference (the refining margin, sometimes called the crack spread) can stay flat or even shrink. Other reasons profit can fail to rise: regulated or politically sensitive pump prices may lag behind costs; the refiner may have bought crude when it was more expensive than today; a weaker local currency can raise the cost of dollar-priced crude faster than local-currency sales; higher prices can reduce demand; finance costs on debt do not fall when prices rise; and unplanned outages reduce the volume sold. Profit also includes non-cash items such as foreign-exchange revaluation, so reported profit and cash generation can move differently.",
  },
  {
    id: "profit-vs-cash",
    match: /(profit|earnings).*(cash ?flow)|(cash ?flow).*(profit|earnings)|cash.*differ/i,
    title: "Why profit and cash flow can differ",
    text:
      "Profit is measured when sales and costs are recognised, not when cash moves. Cash flow can be lower than profit when customers pay late (receivables rise), when crude and product inventories are built up, or when the company pays for crude in advance. It can be higher when depreciation (a non-cash cost) is large, which is typical for new refineries. Foreign-exchange gains or losses on debt revaluation change profit without any cash moving. Capital expenditure uses cash but is not an expense in the profit figure, so free cash flow (operating cash flow minus capital expenditure) is a separate lens.",
  },
  {
    id: "utilization",
    match: /utili[sz]ation|throughput|capacity/i,
    title: "Capacity, throughput, production and sales are different things",
    text:
      "Nameplate capacity is the maximum crude a plant is designed to process, usually in barrels per day. Throughput is the crude actually processed over a period. Utilization is throughput divided by capacity. Production is the volume of refined products that come out, which differs from throughput because of yields and losses. Deliveries and sales are what leave the gate and are paid for, which can differ from production when inventories change. A company stating its capacity has not told you how much it processes.",
  },
  {
    id: "fx",
    match: /(fx|foreign[- ]exchange|currency|naira|devaluation)/i,
    title: "How exchange rates affect a refiner",
    text:
      "Crude oil and much refinery debt are priced in US dollars. If the refiner sells products in local currency, a weaker local currency raises costs and the local value of dollar debt. This can produce large accounting losses on debt revaluation even when operations are unchanged. Export sales in dollars partly offset this effect.",
  },
];
