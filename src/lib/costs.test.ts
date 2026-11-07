import test from "node:test";
import assert from "node:assert/strict";
import {
  demoFixedCosts,
  demoVendors,
  validateVendors,
  vendorExpenses,
} from "./costs";
import { buildDay, scanOperations } from "./onboarding";
import { importedMenu, menuTicket } from "./restaurant-profile";
import { presets, simulate } from "./simulation";
test("supplier expenses use the entered unit price and actual usage", () => {
  const [bag] = vendorExpenses([demoVendors[0]], 100, 40);
  assert.equal(bag.amount, 9.6);
  assert.equal(bag.line.unitPrice, 0.24);
});
test("itemized ingredients replace percentage-based food cost without double charging", () => {
  const c = { ...presets.small.config, vendorItems: demoVendors },
    r = simulate(c);
  const prepared = r.orders.filter(
    (o) => Number.isFinite(o.start) && o.start < c.hours * 60,
  ).length;
  assert.ok(Math.abs(r.food - prepared * 6.2) < 1e-8);
  const takeaway = r.orders.filter(
    (o) => o.status === "completed" && o.channel !== "dineIn",
  ).length;
  assert.ok(Math.abs(r.supplies - takeaway * 0.24) < 1e-8);
  assert.equal(r.overhead, c.overhead + 35);
  assert.equal(
    r.profit,
    r.revenue - r.food - r.fees - r.labor - r.overhead - r.supplies,
  );
});
test("a paper bag price increase reduces profit by the actual packaging cost delta", () => {
  const old = {
      ...presets.small.config,
      vendorItems: [{ ...demoVendors[0], unitPrice: 0.18 }],
    },
    a = simulate(old),
    b = simulate({ ...old, vendorItems: [demoVendors[0]] });
  assert.equal(a.completed, b.completed);
  assert.ok(Math.abs(a.profit - b.profit - (b.supplies - a.supplies)) < 1e-8);
});
test("vendor uploads recognize individual supplier prices and retain missing fields", () => {
  const scan = scanOperations(
    "Maple Paper Co. | Paper bag | packaging | takeawayOrder | 1 | $0.24\nUS Foods | Ingredients | ingredients | preparedOrder | 1 | $6.20",
  );
  assert.equal(scan.found.vendorItems?.length, 2);
  assert.equal(scan.found.vendorItems?.[0].unitPrice, 0.24);
  assert.equal(scan.found.vendorCost, 0);
  assert.ok(scan.missing.includes("Staff roster, shifts and pay"));
});
test("itemized fixed costs and vendor data survive setup and configuration", () => {
  const ops = {
    inventory: 240,
    foodCost: 0.31,
    vendorCost: 85,
    otherCost: 75,
    staff: [
      { name: "A", role: "cook" as const, start: 11, end: 21, pay: 20 },
      { name: "B", role: "front" as const, start: 11, end: 21, pay: 20 },
    ],
    vendorItems: demoVendors,
    fixedCosts: demoFixedCosts,
  };
  const c = buildDay(
    "small",
    ops,
    { day: "Friday", opening: 11, closing: 21, start: 11 },
    {
      orders: 300,
      driveThrough: false,
      driveShare: 20,
      seats: 32,
      stations: 5,
      menu: importedMenu,
    },
  );
  assert.equal(c.overhead, 75);
  assert.deepEqual(c.fixedCosts, demoFixedCosts);
  assert.deepEqual(c.vendorItems, demoVendors);
  assert.equal(c.ticket, menuTicket(importedMenu));
});
test("preloaded menu prices and popularity drive actual generated order baskets", () => {
  const c = {
    ...presets.small.config,
    menu: [{ name: "One dish", price: 17, popularity: 1 }],
  };
  const r = simulate(c);
  assert.ok(r.orders.every((o) => o.item === "One dish" && o.subtotal === 17));
  assert.throws(() =>
    simulate({ ...c, menu: [{ name: "Invalid", price: 17, popularity: 0.5 }] }),
  );
});
test("invalid vendor amounts and incompatible ingredient units are rejected", () => {
  assert.throws(() => validateVendors([{ ...demoVendors[0], unitPrice: -1 }]));
  assert.throws(() => validateVendors([{ ...demoVendors[1], basis: "day" }]));
  assert.throws(() => validateVendors([{ ...demoVendors[0], quantity: NaN }]));
});
