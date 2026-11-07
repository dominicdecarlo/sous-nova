import {
  FixedCost,
  VendorLine,
  validateFixedCosts,
  validateVendors,
  vendorExpenses,
} from "./costs";
import {
  diningTableCount,
  restaurantLayout,
  validatePhysicalLayout,
} from "./restaurant-layout";
import {
  StaffAssignment,
  staffingSlots,
  validateStaffPlan,
  resizeStaffGroup,
} from "./staffing";
import {
  Deal,
  quoteBasket,
  menuPriceEffect,
  validateDeals,
} from "./menu-pricing";
import { scheduleOperations } from "./advanced-operations";
export type Channel = "dineIn" | "pickup" | "doordash" | "driveThrough";
export type MenuItem = { name: string; price: number; popularity: number };
export type PresetId = "takeout" | "small" | "large";
export type StaffMember = {
  name: string;
  role: "cook" | "front" | "back";
  start: number;
  end: number;
  pay: number;
};
export type Config = {
  staffPlan?: StaffAssignment[];
  openingHour?: number;
  diningStart?: number;
  diningEnd?: number;
  referenceHours?: number;
  itemPrices?: Record<string, number>;
  deals?: Deal[];
  holidayDemand?: number;
  preset: PresetId;
  seed: number;
  orders: number;
  cooks: number;
  servers: number;
  seats: number;
  tables?: number;
  stations: number;
  hours: number;
  wage: number;
  priceChange: number;
  demandChange: number;
  driveThrough: boolean;
  driveShare: number;
  ticket: number;
  foodCost: number;
  fee: number;
  overhead: number;
  inventory?: number;
  staff?: StaffMember[];
  menu?: MenuItem[];
  vendorItems?: VendorLine[];
  fixedCosts?: FixedCost[];
};
export const presets: Record<
  PresetId,
  {
    name: string;
    description: string;
    mix: Record<Channel, number>;
    config: Config;
  }
> = {
  takeout: {
    name: "Takeout only",
    description: "A compact kitchen built for orders on the go.",
    mix: { dineIn: 0, pickup: 0.35, doordash: 0.65, driveThrough: 0 },
    config: {
      preset: "takeout",
      seed: 42,
      orders: 160,
      cooks: 2,
      servers: 1,
      seats: 0,
      stations: 4,
      hours: 4,
      wage: 20,
      priceChange: 0,
      demandChange: 0,
      driveThrough: false,
      driveShare: 20,
      ticket: 24,
      foodCost: 0.31,
      fee: 0.25,
      overhead: 100,
    },
  },
  small: {
    name: "Small dine-in",
    description: "A neighborhood favorite with a busy delivery counter.",
    mix: { dineIn: 0.6, pickup: 0.15, doordash: 0.25, driveThrough: 0 },
    config: {
      preset: "small",
      seed: 42,
      orders: 180,
      cooks: 2,
      servers: 2,
      seats: 32,
      stations: 5,
      hours: 4,
      wage: 20,
      priceChange: 0,
      demandChange: 0,
      driveThrough: false,
      driveShare: 20,
      ticket: 29,
      foodCost: 0.31,
      fee: 0.25,
      overhead: 160,
    },
  },
  large: {
    name: "Large dine-in",
    description: "A full dining room, bigger team, and more moving parts.",
    mix: { dineIn: 0.75, pickup: 0.1, doordash: 0.15, driveThrough: 0 },
    config: {
      preset: "large",
      seed: 42,
      orders: 300,
      cooks: 4,
      servers: 4,
      seats: 80,
      stations: 8,
      hours: 4,
      wage: 20,
      priceChange: 0,
      demandChange: 0,
      driveThrough: false,
      driveShare: 20,
      ticket: 34,
      foodCost: 0.31,
      fee: 0.25,
      overhead: 300,
    },
  },
};
export function channelMix(c: Config): Record<Channel, number> {
  const base =
    presets[c.seats === 0 ? "takeout" : c.seats > 80 ? "large" : "small"].mix;
  const d = c.driveThrough ? c.driveShare / 100 : 0;
  return {
    dineIn: base.dineIn * (1 - d),
    pickup: base.pickup * (1 - d),
    doordash: base.doordash * (1 - d),
    driveThrough: d,
  };
}
export function random(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
export function laborCost(c: Config) {
  if (c.staffPlan)
    return staffingSlots(c).reduce(
      (sum, s) => sum + Math.max(0, s.end - s.start) * s.pay,
      0,
    );
  return (["cook", "front"] as const).reduce(
    (total, role) =>
      total +
      Array.from({ length: role === "cook" ? c.cooks : c.servers }, (_, i) => {
        const s = c.staff?.filter((p) => p.role === role)[i];
        return s
          ? Math.max(0, Math.min(c.hours, s.end) - s.start) * s.pay
          : c.hours * c.wage;
      }).reduce((a, b) => a + b, 0),
    0,
  );
}
export type Order = {
  quantity?: number;
  effectivePriceChange?: number;
  appliedDeal?: string;
  busStart?: number;
  busFinish?: number;
  busStaffIndex?: number;
  tableReadyAt?: number;
  prepSupportStart?: number;
  prepSupportEnd?: number;
  prepBackIndex?: number;
  washStart?: number;
  washEnd?: number;
  washBackIndex?: number;
  happiness?: number;
  partySize?: number;
  cookId?: number;
  stationId?: number;
  serverId?: number;
  serviceStart?: number;
  tableId?: number;
  item?: string;
  stockout?: boolean;
  id: string;
  arrival: number;
  channel: Channel;
  prep: number;
  subtotal: number;
  food: number;
  fee: number;
  patience: number;
  start: number;
  ready: number;
  finish: number;
  status: "completed" | "lost" | "unfinished";
  wait: number;
};
export type Frame = {
  occupiedTables?: number[];
  minute: number;
  queue: number;
  cooking: number;
  ready: number;
  seated: number;
  driveQueue: number;
  completed: number;
  lost: number;
};
export type Result = {
  happiness: number;
  supplies: number;
  vendorBreakdown: ReturnType<typeof vendorExpenses>;
  orders: Order[];
  frames: Frame[];
  completed: number;
  lost: number;
  unfinished: number;
  revenue: number;
  food: number;
  fees: number;
  labor: number;
  overhead: number;
  profit: number;
  averageWait: number;
  p90Wait: number;
  utilization: number;
  maxQueue: number;
  channels: Record<Channel, number>;
};
export function validateConfig(c: Config) {
  validateDeals(c);
  if (c.staffPlan !== undefined) {
    validateStaffPlan(c.staffPlan);
    const actual = staffingSlots(c);
    if (
      actual.filter((s) => s.group === "cook").length !== c.cooks ||
      actual.filter((s) => s.group === "front").length !== c.servers
    )
      throw new Error(
        "Staff totals must match the role assignments. Adjust staffing in the Staff tab.",
      );
  }
  if (
    c.openingHour !== undefined &&
    (!Number.isFinite(c.openingHour) ||
      c.openingHour < 0 ||
      c.openingHour + c.hours > 24)
  )
    throw new Error("Store hours must fit within one day.");
  if (
    c.referenceHours !== undefined &&
    (!Number.isFinite(c.referenceHours) ||
      c.referenceHours < 1 ||
      c.referenceHours > 12)
  )
    throw new Error("Imported operating hours must be 1–12.");
  if (
    c.holidayDemand !== undefined &&
    (!Number.isFinite(c.holidayDemand) ||
      c.holidayDemand < -50 ||
      c.holidayDemand > 100)
  )
    throw new Error("Holiday demand must be -50% to +100%.");
  if (
    (c.diningStart !== undefined || c.diningEnd !== undefined) &&
    (!Number.isFinite(c.diningStart) ||
      !Number.isFinite(c.diningEnd) ||
      c.diningStart! < 0 ||
      c.diningEnd! < c.diningStart! ||
      c.diningEnd! > c.hours)
  )
    throw new Error("Dining-room hours must be inside store hours.");
  if (c.vendorItems !== undefined) validateVendors(c.vendorItems);
  if (c.fixedCosts !== undefined) validateFixedCosts(c.fixedCosts);
  if (
    c.menu !== undefined &&
    (!Array.isArray(c.menu) ||
      !c.menu.length ||
      c.menu.length > 60 ||
      c.menu.some(
        (m) =>
          !m ||
          typeof m.name !== "string" ||
          !m.name.trim() ||
          !Number.isFinite(m.price) ||
          m.price < 1 ||
          m.price > 200 ||
          !Number.isFinite(m.popularity) ||
          m.popularity < 0 ||
          m.popularity > 1,
      ) ||
      Math.abs(c.menu.reduce((a, m) => a + m.popularity, 0) - 1) > 0.000001)
  )
    throw new Error(
      "Menu items need prices of $1–$200 and popularity shares totaling 100%.",
    );
  if (
    c.inventory !== undefined &&
    (!Number.isInteger(c.inventory) || c.inventory < 0 || c.inventory > 10000)
  )
    throw new Error("Inventory must be 0–10,000 whole portions.");
  if (c.staff !== undefined) {
    if (!Array.isArray(c.staff) || c.staff.length > 24)
      throw new Error("Staff roster must contain at most 24 people.");
    for (const s of c.staff)
      if (
        !s ||
        typeof s.name !== "string" ||
        !s.name.trim() ||
        !["cook", "front", "back"].includes(s.role) ||
        !Number.isFinite(s.start) ||
        !Number.isFinite(s.end) ||
        s.start < 0 ||
        s.end <= s.start ||
        s.end > 24 ||
        !Number.isFinite(s.pay) ||
        s.pay < 1 ||
        s.pay > 100
      )
        throw new Error(
          "Each staff member needs a name, role, valid shift hours, and hourly pay of $1–$100.",
        );
  }
  for (const [key, min, max] of [
    ["orders", 10, 1000],
    ["cooks", c.staffPlan ? 0 : 1, c.staffPlan ? 96 : 12],
    ["servers", c.staffPlan ? 0 : 1, c.staffPlan ? 96 : 12],
    ["seats", 0, 2000],
    ["stations", 1, 12],
    ["hours", 1, 12],
    ["wage", 1, 100],
    ["priceChange", -30, 50],
    ["demandChange", -50, 100],
    ["driveShare", 0, 80],
    ["ticket", 1, 200],
    ["foodCost", 0, 1],
    ["fee", 0, 1],
    ["overhead", 0, 10000],
    ["seed", 0, 4294967295],
  ] as const) {
    if (!Number.isFinite(c[key]) || c[key] < min || c[key] > max)
      throw new Error(`${key} must be between ${min} and ${max}.`);
  }
  if (!Object.hasOwn(presets, c.preset))
    throw new Error("Unknown restaurant preset.");
  for (const k of [
    "orders",
    "cooks",
    "servers",
    "seats",
    "stations",
    "seed",
  ] as const)
    if (!Number.isInteger(c[k]))
      throw new Error(`${k} must be a whole number.`);
  if (typeof c.driveThrough !== "boolean")
    throw new Error("driveThrough must be true or false.");
  validatePhysicalLayout(
    c.preset,
    c.seats,
    c.tables ?? diningTableCount(c),
    c.stations,
  );
}
export function forecastDemand(c: Config) {
  const priceMultiplier = Math.max(0.2, 1 - (menuPriceEffect(c) / 100) * 0.7);
  return {
    orders: Math.round(
      c.orders *
        (1 + c.demandChange / 100) *
        (1 + (c.holidayDemand ?? 0) / 100) *
        (c.referenceHours ? c.hours / c.referenceHours : 1) *
        priceMultiplier,
    ),
    priceMultiplier,
  };
}
export function customerHappiness(
  wait: number,
  priceChange: number,
  status: Order["status"],
): number {
  const delay = Math.max(0, wait - 8);
  const score =
    status === "completed"
      ? 4.8 - delay * 0.065 - priceChange * 0.025
      : status === "lost"
        ? 1.8 - delay * 0.02 - priceChange * 0.01
        : 2.5 - delay * 0.025 - priceChange * 0.015;
  return Math.max(1, Math.min(5, score));
}
// Common random numbers: every scenario uses identical draws for arrivals, channel,
// complexity and patience. Increasing demand adds orders from the same seeded stream.
export function simulate(
  c: Config,
  options: { includeFrames?: boolean } = {},
): Result {
  validateConfig(c);
  const rng = random(c.seed),
    mix = channelMix(c),
    duration = c.hours * 60;
  const n = forecastDemand(c).orders;
  const channels: Record<Channel, number> = {
    dineIn: 0,
    pickup: 0,
    doordash: 0,
    driveThrough: 0,
  };
  const ingredients =
    c.vendorItems?.filter((v) => v.category === "ingredients") ?? [];
  const ingredientPortion = ingredients.reduce(
    (sum, v) => sum + v.quantity * v.unitPrice,
    0,
  );
  const physicalTables = diningTableCount(c);
  const floorPlan = restaurantLayout(c);
  const tableSizes = floorPlan.tables.map(t=>t.seats);
  const maximumPartySize = Math.max(1, ...tableSizes);
  const orders: Order[] = Array.from({ length: n }, (_, i): Order => {
    const a = rng(),
      b = rng(),
      ch = rng(),
      complexity = rng(),
      value = rng(),
      patience = rng();
    const arrival = ((a + b) / 2) * duration;
    const diningOpen =
      c.seats > 0 &&
      arrival >= (c.diningStart ?? 0) * 60 &&
      arrival < (c.diningEnd ?? c.hours) * 60;
    const activeMix = diningOpen
      ? mix
      : {
          ...mix,
          dineIn: 0,
          pickup: mix.pickup / (1 - mix.dineIn),
          doordash: mix.doordash / (1 - mix.dineIn),
          driveThrough: mix.driveThrough / (1 - mix.dineIn),
        };
    let channel: Channel = "driveThrough",
      acc = 0;
    for (const k of Object.keys(mix) as Channel[]) {
      acc += activeMix[k];
      if (ch < acc) {
        channel = k;
        break;
      }
    }
    let share = 0;
    const item =
      c.menu?.find((m) => {
        share += m.popularity;
        return value < share;
      }) ?? c.menu?.at(-1);
    const basePrice = item?.price ?? c.ticket * (0.65 + value * 0.7);
    const quote = item
      ? quoteBasket(c, item, (i * 0.38196601125 + c.seed * 0.137) % 1)
      : undefined;
    const quantity = quote?.quantity ?? 1;
    return {
      partySize:
        channel === "dineIn"
          ? Math.min(
              maximumPartySize,
              1 + Math.floor(((i * 0.61803398875 + c.seed * 0.173) % 1) * 4),
            )
          : 1,
      item: item?.name,
      quantity,
      effectivePriceChange: quote?.priceChange ?? c.priceChange,
      appliedDeal: quote?.dealName,
      id: `MSK-${String(i + 1).padStart(4, "0")}`,
      arrival,
      channel,
      prep: (5 + complexity * 7) * (1 + (quantity - 1) * 0.45),
      subtotal: quote?.subtotal ?? basePrice * (1 + c.priceChange / 100),
      food:
        (ingredients.length ? ingredientPortion : basePrice * c.foodCost) *
        quantity,
      fee: 0,
      patience: 14 + patience * 14,
      start: Infinity,
      ready: Infinity,
      finish: Infinity,
      status: "unfinished",
      wait: 0,
    };
  }).sort((a, b) => a.arrival - b.arrival);
  // FCFS cook queue constrained by both staff and physical kitchen stations.
  const schedule = (role: StaffMember["role"], count: number) =>
    Array.from({ length: count }, (_, i) => {
      const person = c.staff?.filter((s) => s.role === role)[i];
      return {
        start: person ? person.start * 60 : 0,
        end: person ? Math.min(duration, person.end * 60) : duration,
        pay: person?.pay ?? c.wage,
      };
    });
  const cookSchedule = schedule("cook", c.cooks),
    frontSchedule = schedule("front", c.servers);
  const cooks = cookSchedule.map((s) => s.start);
  const stations = Array(c.stations).fill(0) as number[];
  const tables = Array(Math.max(1, diningTableCount(c))).fill(0) as number[];
  const front = frontSchedule.map((s) => s.start);
  let stock = c.inventory ?? Infinity;
  let drive = 0,
    busy = 0;
  const earliest = (xs: number[]) => xs.indexOf(Math.min(...xs));
  if (c.staffPlan) {
    busy = scheduleOperations(c, orders);
    for (const o of orders) channels[o.channel]++;
  } else
    for (const o of orders) {
      channels[o.channel]++;
      const eligible = tables.map((available, i) =>
        (tableSizes[i] ?? 0) >= (o.partySize ?? 2) ? available : Infinity,
      );
      const t = o.channel === "dineIn" ? earliest(eligible) : 0;
      const station = earliest(stations);
      const possible = cooks.map((available, i) => {
        const at = Math.max(
          o.arrival,
          available,
          stations[station],
          o.channel === "dineIn" ? tables[t] : 0,
        );
        return at + o.prep <= cookSchedule[i].end ? at : Infinity;
      });
      const k = earliest(possible),
        start = possible[k];
      if (stock < (o.quantity ?? 1)) {
        o.status = "lost";
        o.stockout = true;
        o.finish = o.arrival;
        continue;
      }
      if (start - o.arrival > o.patience) {
        o.finish = o.arrival + o.patience;
        o.status = o.finish <= duration ? "lost" : "unfinished";
        o.wait = Math.min(o.patience, duration - o.arrival);
        continue;
      }
      o.start = start;
      o.cookId = k;
      o.stationId = station;
      if (o.channel === "dineIn") o.tableId = t;
      stock -= o.quantity ?? 1;
      o.ready = start + o.prep;
      cooks[k] = o.ready;
      stations[station] = o.ready;
      busy += Math.max(
        0,
        Math.min(duration, o.ready) - Math.min(duration, o.start),
      );
      const target =
        o.tableId !== undefined ? floorPlan.tables[o.tableId] : undefined;
      const serviceTime = target
        ? 1.5 +
          (Math.abs(target.y + 52 - 225) +
            Math.abs(target.x + 54 - 365) +
            130) /
            240
        : 2;
      const handoffs = front.map((at, i) => {
        const time = Math.max(
          o.ready,
          at,
          o.channel === "driveThrough" ? drive : 0,
        );
        return time + serviceTime <= frontSchedule[i].end ? time : Infinity;
      });
      const f = earliest(handoffs);
      const service = handoffs[f];
      o.serverId = f;
      o.serviceStart = service;
      o.finish = service + serviceTime;
      front[f] = o.finish;
      if (o.channel === "driveThrough") drive = o.finish;
      if (o.channel === "dineIn") tables[t] = Math.min(duration, o.finish) + 28;
      o.wait = Math.min(duration, o.finish) - o.arrival;
      if (o.finish > duration) {
        o.status = "unfinished";
        continue;
      }
      if (o.wait > o.patience + 12) {
        o.status = "lost";
        continue;
      }
      o.status = "completed";
      o.fee = o.channel === "doordash" ? o.subtotal * c.fee : 0;
    }
  for (const o of orders)
    o.happiness = customerHappiness(
      o.wait,
      o.effectivePriceChange ?? c.priceChange,
      o.status,
    );
  const happiness = orders.length
    ? orders.reduce((sum, o) => sum + o.happiness!, 0) / orders.length
    : 0;
  const done = orders.filter((o) => o.status === "completed"),
    lost = orders.filter((o) => o.status === "lost");
  const prepared = orders.filter(
    (o) => Number.isFinite(o.start) && o.start < duration,
  ).length;
  const vendorBreakdown = vendorExpenses(
    c.vendorItems ?? [],
    prepared,
    done.filter((o) => o.channel !== "dineIn").length,
    orders
      .filter((o) => Number.isFinite(o.start) && o.start < duration)
      .reduce((n, o) => n + (o.quantity ?? 1), 0),
  );
  const dailyVendorCost = vendorBreakdown
    .filter((v) => v.line.category !== "ingredients" && v.line.basis === "day")
    .reduce((sum, v) => sum + v.amount, 0);
  const supplies = vendorBreakdown
    .filter((v) => v.line.category !== "ingredients" && v.line.basis !== "day")
    .reduce((sum, v) => sum + v.amount, 0);
  const revenue = done.reduce((s, o) => s + o.subtotal, 0),
    food = orders
      .filter((o) => Number.isFinite(o.start) && o.start < duration)
      .reduce((s, o) => s + o.food, 0),
    fees = done.reduce((s, o) => s + o.fee, 0),
    labor = laborCost(c);
  const waits = done.map((o) => o.wait).sort((a, b) => a - b);
  const queueEvents = orders
    .filter((o) => Math.min(o.start, o.finish) > o.arrival)
    .flatMap((o) => [
      { at: o.arrival, delta: 1 },
      { at: Math.min(o.start, o.finish), delta: -1 },
    ])
    .sort((a, b) => a.at - b.at || a.delta - b.delta);
  let activeQueue = 0,
    maxQueue = 0;
  for (const event of queueEvents) {
    activeQueue += event.delta;
    maxQueue = Math.max(maxQueue, activeQueue);
  }
  const frames: Frame[] =
    options.includeFrames === false
      ? []
      : Array.from({ length: Math.ceil(duration) + 1 }, (_, minute) => ({
          occupiedTables: orders
            .filter(
              (o) =>
                o.tableId !== undefined &&
                o.start <= minute &&
                (o.tableReadyAt ?? o.finish + 28) > minute,
            )
            .map((o) => o.tableId!),
          minute,
          queue: orders.filter(
            (o) => o.arrival <= minute && o.start > minute && o.finish > minute,
          ).length,
          cooking: orders.filter((o) => o.start <= minute && o.ready > minute)
            .length,
          ready: orders.filter((o) => o.ready <= minute && o.finish > minute)
            .length,
          seated: orders.filter(
            (o) =>
              o.channel === "dineIn" &&
              o.start <= minute &&
              o.finish + 28 > minute,
          ).length,
          driveQueue: orders.filter(
            (o) =>
              o.channel === "driveThrough" &&
              o.arrival <= minute &&
              o.finish > minute,
          ).length,
          completed: done.filter((o) => o.finish <= minute).length,
          lost: lost.filter((o) => o.finish <= minute).length,
        }));
  return {
    happiness,
    supplies,
    vendorBreakdown,
    orders,
    frames,
    completed: done.length,
    lost: lost.length,
    unfinished: n - done.length - lost.length,
    revenue,
    food,
    fees,
    labor,
    overhead: c.overhead + dailyVendorCost,
    profit:
      revenue - food - fees - labor - c.overhead - dailyVendorCost - supplies,
    averageWait: waits.length
      ? waits.reduce((s, w) => s + w, 0) / waits.length
      : 0,
    p90Wait: waits[Math.max(0, Math.ceil(waits.length * 0.9) - 1)] ?? 0,
    utilization: Math.min(
      1,
      busy / (Math.max(1, Math.min(c.cooks, c.stations)) * duration),
    ),
    maxQueue,
    channels,
  };
}
export function experiments(c: Config) {
  const baseline = simulate(c);
  return [
    {
      name: "Add one cook",
      config: { ...c, cooks: Math.min(12, c.cooks + 1) },
    },
    { name: "Cut one cook", config: { ...c, cooks: Math.max(1, c.cooks - 1) } },
    { name: "Raise menu prices 8%", config: { ...c, priceChange: 8 } },
    {
      name: "Add a front-of-house teammate",
      config: { ...c, servers: Math.min(12, c.servers + 1) },
    },
  ]
    .map((x) => {
      const config = c.staffPlan
        ? resizeStaffGroup(
            resizeStaffGroup(x.config, "cook", x.config.cooks),
            "front",
            x.config.servers,
          )
        : x.config;
      return { ...x, config, result: simulate(config) };
    })
    .map((x) => ({ ...x, delta: x.result.profit - baseline.profit }))
    .sort((a, b) => b.delta - a.delta);
}
export function exportCSV(r: Result) {
  return [
    "id,channel,arrival_min,prep_min,subtotal,platform_fee,food_cost,wait_min,status",
    ...r.orders.map((o) =>
      [
        o.id,
        o.channel,
        o.arrival.toFixed(2),
        o.prep.toFixed(2),
        o.subtotal.toFixed(2),
        o.fee.toFixed(2),
        o.food.toFixed(2),
        o.wait.toFixed(2),
        o.status,
      ].join(","),
    ),
  ].join("\n");
}
