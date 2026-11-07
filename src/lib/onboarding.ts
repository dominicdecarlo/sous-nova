import {
  Config,
  presets,
  PresetId,
  StaffMember,
  validateConfig,
} from "./simulation";
import {
  FixedCost,
  VendorLine,
  validateFixedCosts,
  validateVendors,
} from "./costs";
import { defaultStaffPlan } from "./staffing";
export const weekdays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
export type Day = (typeof weekdays)[number];
export type Operations = {
  inventory: number;
  foodCost: number;
  vendorCost: number;
  otherCost: number;
  staff: StaffMember[];
  vendorItems?: VendorLine[];
  fixedCosts?: FixedCost[];
};
export type Scan = { found: Partial<Operations>; missing: string[] };
export const required = [
  "inventory",
  "foodCost",
  "vendorCost",
  "otherCost",
  "staff",
] as const;
export const fieldNames = {
  inventory: "Available portions",
  foodCost: "Food cost percentage",
  vendorCost: "Daily vendor costs",
  otherCost: "Other daily costs",
  staff: "Staff roster, shifts and pay",
};
export const sampleDocument = `MAPLE STREET KITCHEN — OPERATING NOTES\nInventory: 240 portions\nFood cost: 31%\nVendor costs per day: $85\nOther costs per day: $75\n\nStaff (name, role, start, end, hourly pay)\nAlex, cook, 11:00, 21:00, $22\nSam, cook, 11:00, 21:00, $20\nJordan, front, 11:00, 21:00, $18\nRiley, front, 15:00, 21:00, $18\n\nSupplier | Item | Category | Charging unit | Quantity | Unit price\nMaple Paper Co. | Paper takeaway bag | packaging | takeawayOrder | 1 | 0.24\nUS Foods | Burger ingredients / portion | ingredients | preparedOrder | 1 | 6.20\nClean Kitchen Services | Equipment & linen service | services | day | 1 | 35\n\nFixed cost | Rent allocation | 45\nFixed cost | Utilities | 22\nFixed cost | Software & insurance | 8\n`;
export function clock(hour: number) {
  const h = Math.floor(hour),
    m = Math.round((hour - h) * 60);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
export function parseTime(value: string) {
  if (!/^\d{1,2}:\d{2}$/.test(value.trim())) return NaN;
  const [h, m] = value.split(":").map(Number);
  return h >= 0 && h <= 24 && m >= 0 && m < 60 && (h < 24 || m === 0)
    ? h + m / 60
    : NaN;
}
export function scanOperations(text: string): Scan {
  const found: Partial<Operations> = {};
  try {
    const data = JSON.parse(text);
    for (const key of required)
      if (Object.hasOwn(data, key))
        (found as Record<string, unknown>)[key] = data[key];
    if (data.vendorItems !== undefined) {
      validateVendors(data.vendorItems);
      found.vendorItems = data.vendorItems;
    }
    if (data.fixedCosts !== undefined) {
      validateFixedCosts(data.fixedCosts);
      found.fixedCosts = data.fixedCosts;
    }
  } catch {
    /* Text extraction is the other supported document shape. */
  }
  const patterns = {
    inventory:
      /(?:inventory|available portions|stock portions)\s*[:=]\s*([\d,]+)/i,
    foodCost:
      /food\s*cost(?:\s*(?:percentage|percent|%))?\s*[:=]\s*([\d.]+)\s*%?/i,
    vendorCost:
      /vendor\s*costs?(?:\s*per\s*day|\s*daily)?\s*[:=]\s*\$?([\d,.]+)/i,
    otherCost:
      /(?:other|fixed|overhead)\s*(?:daily\s*)?costs?(?:\s*per\s*day)?\s*[:=]\s*\$?([\d,.]+)/i,
  };
  for (const key of Object.keys(patterns) as (keyof typeof patterns)[]) {
    const match = text.match(patterns[key]);
    if (match && found[key] === undefined)
      found[key] =
        Number(match[1].replaceAll(",", "")) / (key === "foodCost" ? 100 : 1);
  }
  if (!found.staff) {
    const staff: StaffMember[] = [];
    for (const line of text.split(/[\r\n]+/)) {
      const cells = line.split(/[,|;]/).map((s) => s.trim());
      if (cells.length !== 5) continue;
      const [name, role, start, end, pay] = cells;
      const normalized = role.toLowerCase();
      if (
        ![
          "cook",
          "chef",
          "front",
          "server",
          "foh",
          "front-of-house",
          "back",
          "backroom",
          "dishwasher",
          "prep",
        ].includes(normalized)
      )
        continue;
      staff.push({
        name,
        role: ["cook", "chef"].includes(normalized)
          ? "cook"
          : ["back", "backroom", "dishwasher", "prep"].includes(normalized)
            ? "back"
            : "front",
        start: parseTime(start),
        end: parseTime(end),
        pay: Number(pay.replace(/[$\s]/g, "")),
      });
    }
    if (staff.length) found.staff = staff;
  }
  if (!found.vendorItems) {
    const lines: VendorLine[] = [];
    for (const [i, line] of text.split(/[\r\n]+/).entries()) {
      const cells = line.split("|").map((v) => v.trim());
      if (
        ![6, 7].includes(cells.length) ||
        !["ingredients", "packaging", "services"].includes(cells[2])
      )
        continue;
      const [supplier, item, category, basis, quantity, current] = cells;
      const entry = {
        id: `upload-${i}`,
        supplier,
        item,
        category,
        basis,
        quantity: Number(quantity),
        unitPrice: Number(current.replace("$", "")),
      } as VendorLine;
      try {
        validateVendors([entry]);
        lines.push(entry);
      } catch {
        /* Invalid item remains available for manual entry. */
      }
    }
    if (lines.length) found.vendorItems = lines;
  }
  if (found.vendorItems?.length && found.vendorCost === undefined)
    found.vendorCost = 0;
  if (!found.fixedCosts) {
    const costs: FixedCost[] = [];
    for (const [i, line] of text.split(/[\r\n]+/).entries()) {
      const cells = line.split("|").map((v) => v.trim());
      if (cells.length !== 3 || cells[0].toLowerCase() !== "fixed cost")
        continue;
      const cost = {
        id: `fixed-${i}`,
        name: cells[1],
        amount: Number(cells[2].replace("$", "")),
      };
      try {
        validateFixedCosts([cost]);
        costs.push(cost);
      } catch {
        /* Leave invalid fields for manual entry. */
      }
    }
    if (costs.length) found.fixedCosts = costs;
  }
  if (found.fixedCosts?.length && found.otherCost === undefined)
    found.otherCost = found.fixedCosts.reduce((sum, v) => sum + v.amount, 0);
  // Unrecognized or out-of-range values remain missing; they are never invented.
  for (const key of required) {
    const v = found[key];
    if (key === "staff") {
      if (
        !Array.isArray(v) ||
        !v.length ||
        v.some(
          (s) =>
            !s ||
            typeof s.name !== "string" ||
            !s.name.trim() ||
            !["cook", "front", "back"].includes(s.role) ||
            !Number.isFinite(s.start) ||
            !Number.isFinite(s.end) ||
            s.start < 0 ||
            s.end > 24 ||
            s.end <= s.start ||
            !Number.isFinite(s.pay) ||
            s.pay < 1 ||
            s.pay > 100,
        ) ||
        !v.some((s) => s.role === "cook") ||
        !v.some((s) => s.role === "front")
      )
        delete found.staff;
    } else if (
      typeof v !== "number" ||
      !Number.isFinite(v) ||
      v < 0 ||
      (key === "foodCost" && v > 1) ||
      (key === "inventory" && (!Number.isInteger(v) || v > 10000)) ||
      (key !== "foodCost" && key !== "inventory" && v > 5000)
    )
      delete found[key];
  }
  return {
    found,
    missing: required
      .filter((k) => found[k] === undefined)
      .map((k) => fieldNames[k]),
  };
}
export type DaySetup = {
  day: Day;
  opening: number;
  closing: number;
  start: number;
};
export function buildDay(
  preset: PresetId,
  operations: Operations,
  day: DaySetup,
  changes: {
    orders: number;
    driveThrough: boolean;
    driveShare: number;
    seats: number;
    tables?: number;
    stations: number;
    menu?: Config["menu"];
  },
): Config {
  if (
    !weekdays.includes(day.day) ||
    !Number.isFinite(day.opening) ||
    !Number.isFinite(day.closing) ||
    day.opening < 0 ||
    day.closing > 24 ||
    day.closing - day.opening < 1 ||
    day.closing - day.opening > 12 ||
    !Number.isFinite(day.start) ||
    day.start < day.opening ||
    day.start >= day.closing
  )
    throw new Error(
      "Choose a 1–12 hour opening window and a start time within it.",
    );
  const scan = scanOperations(JSON.stringify(operations));
  if (scan.missing.length)
    throw new Error(`Complete: ${scan.missing.join(", ")}.`);
  const staff = operations.staff.map((s) => ({
    ...s,
    start: Math.max(0, s.start - day.opening),
    end: Math.min(day.closing, s.end) - day.opening,
  }));
  if (staff.some((s) => s.end <= s.start))
    throw new Error("Every staff shift must overlap restaurant opening hours.");
  const demand = [-0.2, -0.15, -0.1, 0, 0.2, 0.3, 0.05][
    weekdays.indexOf(day.day)
  ];
  preset =
    changes.seats === 0 ? "takeout" : changes.seats > 80 ? "large" : "small";
  const c: Config = {
    ...presets[preset].config,
    ...changes,
    preset,
    tables: Math.ceil(changes.seats / 4),
    openingHour: day.opening,
    referenceHours: day.closing - day.opening,
    diningStart: 0,
    diningEnd: changes.seats ? day.closing - day.opening : 0,
    ticket:
      changes.menu?.reduce(
        (sum, item) => sum + item.price * item.popularity,
        0,
      ) ?? presets[preset].config.ticket,
    hours: day.closing - day.opening,
    demandChange: demand * 100,
    inventory: operations.inventory,
    foodCost: operations.foodCost,
    overhead:
      (operations.vendorItems?.length ? 0 : operations.vendorCost) +
      operations.otherCost,
    vendorItems: operations.vendorItems,
    fixedCosts: operations.fixedCosts,
    staff,
    cooks: staff.filter((s) => s.role === "cook").length,
    servers: staff.filter((s) => s.role === "front").length,
  };
  c.staffPlan = defaultStaffPlan(c);
  validateConfig(c);
  return c;
}
