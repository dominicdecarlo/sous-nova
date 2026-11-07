import test from "node:test";
import assert from "node:assert/strict";
import {
  Config,
  presets,
  simulate,
  validateConfig,
  forecastDemand,
  laborCost,
  channelMix,
} from "./simulation";
import {
  withStaffPlan,
  setStoreHours,
  staffingSlots,
  resizeStaffGroup,
} from "./staffing";
import { quoteBasket, menuPriceEffect } from "./menu-pricing";
import { buildReplay, replayAt } from "./operations-replay";
import {
  scenarioCandidates,
  optimizeScenario,
  preservePay,
} from "./scenario-optimizer";
import { demoVendors } from "./costs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ScenarioTabs from "../app/scenario-tabs";
const menu = [
  { name: "Burger", price: 20, popularity: 0.7 },
  { name: "Salad", price: 15, popularity: 0.3 },
];
const base = (): Config =>
  withStaffPlan(
    {
      ...presets.small.config,
      hours: 6,
      referenceHours: 6,
      orders: 100,
      seats: 80,
      stations: 6,
      openingHour: 11,
      diningStart: 0,
      diningEnd: 6,
      menu,
      inventory: 1000,
    },
    [
      { id: "c", role: "cook", count: 4, start: 0, end: 6 },
      { id: "w", role: "waiter", count: 2, start: 0, end: 6 },
      { id: "b", role: "busser", count: 1, start: 0, end: 6 },
      { id: "f", role: "cashier", count: 2, start: 0, end: 6 },
      { id: "p", role: "prep", count: 1, start: 0, end: 6 },
      { id: "d", role: "dishwasher", count: 1, start: 0, end: 6 },
    ],
  );
test("seat count alone determines takeout and all parties use four-seat tables", () => {
  const c = { ...base(), preset: "large" as const, seats: 0, tables: 80 },
    r = simulate(c);
  assert.equal(channelMix(c).dineIn, 0);
  assert.equal(r.channels.dineIn, 0);
  assert.equal(buildReplay(c, r.orders).plan.tables.length, 0);
  const seated = simulate(base()),
    sizes = new Set(
      seated.orders
        .filter((o) => o.channel === "dineIn")
        .map((o) => o.partySize),
    );
  assert.deepEqual([...sizes].sort(), [1, 2, 3, 4]);
  assert.ok(
    buildReplay(base(), seated.orders).plan.tables.every((t) => t.seats === 4),
  );
});
test("dining hours route outside-window demand to takeout and prevent late seating", () => {
  const c = { ...base(), diningStart: 1, diningEnd: 3 },
    r = simulate(c);
  assert.ok(r.channels.dineIn > 0);
  for (const o of r.orders.filter((o) => o.channel === "dineIn")) {
    assert.ok(o.arrival >= 60 && o.arrival < 180);
    if (Number.isFinite(o.start)) assert.ok(o.start < 180);
  }
  assert.equal(
    simulate({ ...c, diningStart: 0, diningEnd: 0 }).channels.dineIn,
    0,
  );
});
test("dedicated cashiers cannot serve tables and waiters cannot hand off pickup", () => {
  const c = base(),
    cashier = withStaffPlan(
      c,
      c.staffPlan!.filter((s) => s.role === "cook" || s.role === "cashier"),
    ),
    a = simulate(cashier);
  assert.equal(
    a.orders.filter((o) => o.channel === "dineIn" && o.status === "completed")
      .length,
    0,
  );
  assert.ok(
    a.orders.some((o) => o.channel === "pickup" && o.status === "completed"),
  );
  const waiter = withStaffPlan(
      c,
      c.staffPlan!.filter((s) => s.role === "cook" || s.role === "waiter"),
    ),
    b = simulate(waiter);
  assert.ok(
    b.orders.some((o) => o.channel === "dineIn" && o.status === "completed"),
  );
  assert.equal(
    b.orders.filter((o) => o.channel !== "dineIn" && o.status === "completed")
      .length,
    0,
  );
});
test("role shifts constrain all work and payroll; shared staff never double-book service and bussing", () => {
  const c = withStaffPlan(base(), [
      { id: "c", role: "cook", count: 4, start: 0, end: 6 },
      { id: "f", role: "front", count: 3, start: 1, end: 4 },
    ]),
    r = simulate(c);
  assert.equal(laborCost(c), (4 * 6 + 3 * 3) * c.wage);
  assert.equal(r.labor, laborCost(c));
  for (let index = 0; index < 3; index++) {
    const jobs = r.orders
      .flatMap((o) => [
        ...(o.serverId === index ? [{ s: o.serviceStart!, e: o.finish }] : []),
        ...(o.busStaffIndex === index
          ? [{ s: o.busStart!, e: o.busFinish! }]
          : []),
      ])
      .sort((a, b) => a.s - b.s);
    for (let i = 0; i < jobs.length; i++) {
      assert.ok(jobs[i].s >= 60 && jobs[i].e <= 240);
      if (i) assert.ok(jobs[i - 1].e <= jobs[i].s + 1e-8);
    }
  }
  for (const o of r.orders.filter(
    (o) => o.tableId !== undefined && o.busFinish !== undefined,
  ))
    assert.equal(o.tableReadyAt, o.busFinish);
});
test("table reservations include bussing and cook/station bookings never overlap", () => {
  const c = base(),
    r = simulate(c);
  for (const key of ["cookId", "stationId", "tableId"] as const) {
    const ids = new Set(r.orders.map((o) => o[key]));
    for (const id of ids) {
      if (id === undefined) continue;
      const jobs = r.orders
        .filter((o) => o[key] === id)
        .sort((a, b) => a.start - b.start);
      for (let i = 1; i < jobs.length; i++)
        assert.ok(
          (key === "tableId" ? jobs[i - 1].tableReadyAt! : jobs[i - 1].ready) <=
            jobs[i].start + 1e-8,
          `${key} ${id}`,
        );
    }
  }
});
test("zero cooking staff loses orders gracefully without spending ingredients", () => {
  const c = resizeStaffGroup(base(), "cook", 0),
    r = simulate(c);
  assert.equal(r.completed, 0);
  assert.equal(r.food, 0);
  assert.ok(Number.isFinite(r.profit));
  assert.ok(r.orders.every((o) => !Number.isFinite(o.start)));
});
test("prep and dishwashing support changes cooking work and animates actual backroom jobs", () => {
  const c = base(),
    r = simulate(c),
    without = simulate(
      withStaffPlan(
        c,
        c.staffPlan!.filter(
          (s) => s.role !== "prep" && s.role !== "dishwasher",
        ),
      ),
    );
  assert.ok(r.orders.some((o) => Number.isFinite(o.prepSupportStart)));
  assert.ok(r.orders.some((o) => Number.isFinite(o.washStart)));
  assert.ok(r.orders[0].prep < without.orders[0].prep);
  const replay = buildReplay(c, r.orders),
    o = r.orders.find((o) => Number.isFinite(o.washStart))!;
  assert.ok(
    replayAt(replay, (o.washStart! + o.washEnd!) / 2).actors.some(
      (a) => a.kind === "backroom" && a.segment.state === "Washing dishes",
    ),
  );
  const bus = r.orders.find((o) => Number.isFinite(o.busStart))!;
  assert.ok(
    replayAt(
      replay,
      bus.busStart! + (bus.busFinish! - bus.busStart!) * 0.9,
    ).actors.some((a) => a.segment.state.startsWith("Bussing table")),
  );
});
test("store hours preserve wall-clock shifts, clip coverage and scale expected demand", () => {
  const c = base(),
    short = setStoreHours(c, 12, 3);
  validateConfig(short);
  assert.equal(short.openingHour, 12);
  assert.equal(short.hours, 3);
  assert.equal(forecastDemand(short).orders, forecastDemand(c).orders / 2);
  assert.ok(staffingSlots(short).every((s) => s.start >= 0 && s.end <= 3));
  const late = setStoreHours(
    {
      ...c,
      staffPlan: [{ id: "short", role: "cook", count: 2, start: 0, end: 1 }],
    },
    17,
    2,
  );
  validateConfig(late);
  assert.equal(late.cooks, 0);
});
test("per-item and global prices compound and weight demand by menu popularity", () => {
  const c = { ...base(), itemPrices: { Burger: 30 }, priceChange: 10 },
    q = quoteBasket(c, menu[0], 0.1);
  assert.equal(q.subtotal, 33);
  assert.ok(Math.abs(q.priceChange - 65) < 1e-8);
  assert.ok(menuPriceEffect(c) > 10);
  assert.ok(forecastDemand(c).orders < forecastDemand(base()).orders);
});
test("BOGO uses two portions, charges one, and only the largest eligible deal applies", () => {
  const c: Config = {
    ...base(),
    deals: [
      { id: "b", type: "bogo", item: "Burger", enabled: true },
      { id: "t", type: "threshold", minimum: 30, percent: 20, enabled: true },
    ],
  };
  const q = quoteBasket(c, menu[0], 0.2);
  assert.equal(q.quantity, 2);
  assert.equal(q.subtotal, 20);
  assert.equal(q.priceChange, -50);
  assert.equal(q.dealName, "BOGO Burger");
  const better = quoteBasket(
    {
      ...c,
      deals: [
        ...c.deals!,
        {
          id: "bigger",
          type: "threshold",
          minimum: 30,
          percent: 60,
          enabled: true,
        },
      ],
    },
    menu[0],
    0.2,
  );
  assert.equal(better.subtotal, 16);
  assert.equal(better.dealName, "60% off $30+");
  const disabled = quoteBasket(
    { ...c, deals: c.deals!.map((d) => ({ ...d, enabled: false })) },
    menu[0],
    0.2,
  );
  assert.equal(disabled.quantity, 1);
  assert.equal(disabled.subtotal, 20);
});
test("order-threshold deals apply at the minimum and leave smaller baskets unchanged", () => {
  const c: Config = {
    ...base(),
    deals: [
      { id: "t", type: "threshold", minimum: 40, percent: 10, enabled: true },
    ],
  };
  assert.equal(quoteBasket(c, menu[0], 0.1).subtotal, 20);
  assert.equal(quoteBasket(c, menu[0], 0.7).subtotal, 36);
});
test("legacy imported scenarios also count free portions against stock", () => {
  const c: Config = {
      ...presets.takeout.config,
      menu: [{ name: "Burger", price: 20, popularity: 1 }],
      inventory: 9,
      deals: [{ id: "b", type: "bogo", item: "Burger", enabled: true }],
    },
    r = simulate(c);
  assert.equal(
    r.orders
      .filter((o) => Number.isFinite(o.start))
      .reduce((n, o) => n + o.quantity!, 0),
    8,
  );
});
test("free portions consume inventory and reconcile supplier ingredients, food and profit", () => {
  const c: Config = {
    ...base(),
    seats: 0,
    inventory: 9,
    vendorItems: demoVendors,
    menu: [menu[0]],
    deals: [{ id: "b", type: "bogo", item: "Burger", enabled: true }],
  };
  c.menu![0] = { ...menu[0], popularity: 1 };
  const r = simulate(c),
    prepared = r.orders.filter((o) => Number.isFinite(o.start)),
    portions = prepared.reduce((n, o) => n + o.quantity!, 0);
  assert.equal(portions, 8);
  assert.ok(prepared.every((o) => o.quantity === 2 && o.subtotal === 20));
  assert.equal(r.food, portions * 6.2);
  assert.equal(
    r.vendorBreakdown.find((v) => v.line.category === "ingredients")!.amount,
    r.food,
  );
  assert.equal(
    r.profit,
    r.revenue - r.food - r.fees - r.labor - r.overhead - r.supplies,
  );
  assert.ok(r.orders.some((o) => o.stockout));
});
test("holidays multiply demand and detailed settings stay deterministic with or without frames", () => {
  const c = { ...base(), holidayDemand: 60 };
  assert.equal(forecastDemand(c).orders, 160);
  const a = simulate(c),
    b = simulate(c, { includeFrames: false });
  assert.deepEqual(a.orders, b.orders);
  assert.equal(a.profit, b.profit);
  assert.deepEqual(a, simulate(c));
});
test("Ask Sous varies effective role counts, preserves rates and keeps deals and shifts", () => {
  const c = base(),
    options = { cooks: [2, 4], servers: [2, 5], prices: [0, 10] },
    grid = scenarioCandidates(c, options);
  for (const cfg of grid.configs) {
    assert.equal(
      staffingSlots(cfg).filter((s) => s.group === "cook").length,
      cfg.cooks,
    );
    assert.equal(
      staffingSlots(cfg).filter((s) => s.group === "front").length,
      cfg.servers,
    );
    assert.equal(
      staffingSlots(cfg).filter((s) => s.group === "back").length,
      2,
    );
  }
  const r = optimizeScenario(c, options);
  assert.ok(r.best.result.profit >= simulate(c).profit);
  assert.deepEqual(r.best.config.deals, c.deals);
  assert.equal(preservePay(c, { ...r.best.config, wage: 1 }).wage, c.wage);
});
test("invalid role shifts, offers, prices and dining hours are rejected", () => {
  const c = base();
  for (const patch of [
    { staffPlan: [{ id: "x", role: "cook", count: 2, start: 3, end: 2 }] },
    { itemPrices: { Burger: 0 } },
    { deals: [{ id: "x", type: "bogo", item: "Missing", enabled: true }] },
    {
      deals: [
        { id: "x", type: "threshold", minimum: 0, percent: 99, enabled: true },
      ],
    },
    { diningStart: 4, diningEnd: 3 },
    { holidayDemand: NaN },
  ])
    assert.throws(() => validateConfig({ ...c, ...patch } as Config));
});
test("scenario tabs expose staff, hours, menu and other settings with fixed pay", () => {
  const html = renderToStaticMarkup(
    createElement(ScenarioTabs, { config: base(), onPatch: () => {} }),
  );
  assert.equal((html.match(/role="tab"/g) ?? []).length, 4);
  for (const label of [
    "Staff",
    "Hours",
    "Menu",
    "Other",
    "Front room",
    "Backroom",
    "From",
    "Until",
    "Pay stays fixed",
  ])
    assert.ok(html.includes(label));
  assert.ok(!html.includes("Hourly pay"));
});
