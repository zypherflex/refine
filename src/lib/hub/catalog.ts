/** Reference lists for the trade hub: products, states, roles. Pure data and helpers, safe on client and server. */

export const ROLES = [
  { id: "SELLER", label: "Seller", who: "Depots, refill plants, stations, importers and resin sellers" },
  { id: "BUYER", label: "Buyer", who: "Kiosks, filling stations, factories, fleets, hotels and restaurants" },
  { id: "HAULIER", label: "Haulier", who: "Tanker, LPG bobtail, CNG cascade and flatbed operators" },
  { id: "REFINERY", label: "Refinery", who: "Modular refiners and other licensed refineries" },
] as const;
export type RoleId = (typeof ROLES)[number]["id"];
export const roleLabel = (id: string) => ROLES.find((r) => r.id === id)?.label ?? id;

/** Products traded on the hub. `priceUnit` is set only where the price board reports a per-unit price. */
export const PRODUCTS = [
  { id: "LPG", label: "LPG (cooking gas)", unit: "kg", priceUnit: "kg" },
  { id: "DIESEL", label: "Diesel (AGO)", unit: "litres", priceUnit: "litre" },
  { id: "PETROL", label: "Petrol (PMS)", unit: "litres", priceUnit: "litre" },
  { id: "KEROSENE", label: "Kerosene (DPK)", unit: "litres", priceUnit: "litre" },
  { id: "CNG", label: "CNG", unit: "scm", priceUnit: "scm" },
  { id: "JET", label: "Jet A-1", unit: "litres", priceUnit: null },
  { id: "CRUDE", label: "Crude oil", unit: "barrels", priceUnit: null },
  { id: "RESIN", label: "Polypropylene resin", unit: "tonnes", priceUnit: null },
  { id: "SERVICES", label: "Plant services", unit: "jobs", priceUnit: null },
] as const;
export type ProductId = (typeof PRODUCTS)[number]["id"];
export const productById = (id: string) => PRODUCTS.find((p) => p.id === id);
export const productLabel = (id: string) => productById(id)?.label ?? id;
export const PRICED_PRODUCTS = PRODUCTS.filter((p) => p.priceUnit);
export const UNITS = ["kg", "tonnes", "litres", "scm", "barrels", "cylinders", "jobs"] as const;

export const GASES = [
  { id: "LPG", label: "LPG" },
  { id: "CNG", label: "CNG" },
  { id: "PNG", label: "Pipeline gas" },
] as const;

export const SITE_KINDS = [
  { id: "SUPPLY", label: "Supply", help: "Refill plant, depot, CNG station or mother station that sells gas" },
  { id: "DELIVERY", label: "Delivery", help: "A haulier or distributor covering this state" },
  { id: "DEMAND", label: "Demand", help: "A buyer that needs gas here: factory, fleet, kiosk cluster, estate" },
] as const;

export const FREQUENCIES = [
  { id: "WEEKLY", label: "Every week", days: 7 },
  { id: "FORTNIGHTLY", label: "Every two weeks", days: 14 },
  { id: "MONTHLY", label: "Every month", days: 30 },
] as const;
export const frequencyLabel = (id: string) => FREQUENCIES.find((f) => f.id === id)?.label ?? id;

/**
 * Nigeria's 36 states and the FCT, each with a cell in a tile-grid map (column, row). The grid keeps neighbours
 * roughly where they sit on a real map, so gaps can be read at a glance without detailed boundaries.
 */
export const STATES = [
  { id: "SO", name: "Sokoto", col: 1, row: 0 }, { id: "KT", name: "Katsina", col: 3, row: 0 }, { id: "JI", name: "Jigawa", col: 5, row: 0 }, { id: "YO", name: "Yobe", col: 6, row: 0 },
  { id: "KE", name: "Kebbi", col: 0, row: 1 }, { id: "ZA", name: "Zamfara", col: 2, row: 1 }, { id: "KN", name: "Kano", col: 4, row: 1 }, { id: "BA", name: "Bauchi", col: 5, row: 1 }, { id: "BO", name: "Borno", col: 7, row: 1 },
  { id: "NI", name: "Niger", col: 1, row: 2 }, { id: "KD", name: "Kaduna", col: 3, row: 2 }, { id: "PL", name: "Plateau", col: 4, row: 2 }, { id: "GO", name: "Gombe", col: 6, row: 2 }, { id: "AD", name: "Adamawa", col: 7, row: 2 },
  { id: "KW", name: "Kwara", col: 1, row: 3 }, { id: "FC", name: "FCT Abuja", col: 2, row: 3 }, { id: "NA", name: "Nasarawa", col: 3, row: 3 }, { id: "TA", name: "Taraba", col: 6, row: 3 },
  { id: "OY", name: "Oyo", col: 0, row: 4 }, { id: "EK", name: "Ekiti", col: 2, row: 4 }, { id: "KO", name: "Kogi", col: 3, row: 4 }, { id: "BE", name: "Benue", col: 4, row: 4 },
  { id: "OG", name: "Ogun", col: 0, row: 5 }, { id: "OS", name: "Osun", col: 1, row: 5 }, { id: "ON", name: "Ondo", col: 2, row: 5 }, { id: "ED", name: "Edo", col: 3, row: 5 }, { id: "EN", name: "Enugu", col: 4, row: 5 }, { id: "EB", name: "Ebonyi", col: 5, row: 5 },
  { id: "LA", name: "Lagos", col: 0, row: 6 }, { id: "DE", name: "Delta", col: 2, row: 6 }, { id: "AN", name: "Anambra", col: 3, row: 6 }, { id: "IM", name: "Imo", col: 4, row: 6 }, { id: "AB", name: "Abia", col: 5, row: 6 }, { id: "CR", name: "Cross River", col: 6, row: 6 },
  { id: "BY", name: "Bayelsa", col: 2, row: 7 }, { id: "RI", name: "Rivers", col: 3, row: 7 }, { id: "AK", name: "Akwa Ibom", col: 5, row: 7 },
] as const;
export type StateId = (typeof STATES)[number]["id"];
export const isState = (id: string): id is StateId => STATES.some((s) => s.id === id);
export const stateName = (id: string) => STATES.find((s) => s.id === id)?.name ?? id;
export const STATES_BY_NAME = [...STATES].sort((a, b) => a.name.localeCompare(b.name));
