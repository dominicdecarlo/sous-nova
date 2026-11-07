import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import RestaurantFloor from "../app/restaurant-floor";
import ManualLayout from "../app/manual-layout";
import CostEditor from "../app/cost-editor";
import { RestaurantReview } from "../app/restaurant-review";
import {
  diningTableCount,
  restaurantLayout,
  validatePhysicalLayout,
} from "./restaurant-layout";
import { demoVendors, demoFixedCosts } from "./costs";
import { importedMenu } from "./restaurant-profile";
import { presets, simulate } from "./simulation";
const emptyFrame = {
  minute: 0,
  queue: 0,
  cooking: 0,
  ready: 0,
  seated: 0,
  driveQueue: 0,
  completed: 0,
  lost: 0,
  occupiedTables: [],
};
const noop = () => {};
test('arbitrary seat counts preserve exact capacity with mostly four-seat tables',()=>{
 for(const seats of [1,2,3,5,37,319,1999]){
 const c={...presets.small.config,seats};validatePhysicalLayout('',seats,0,5);
 const layout=restaurantLayout(c);assert.equal(layout.tables.reduce((n,t)=>n+t.seats,0),seats);
 assert.equal(layout.tables.filter(t=>t.seats===4).length,Math.floor(seats/4));
 const result=simulate(c);for(const o of result.orders.filter(o=>o.tableId!==undefined))assert.ok(o.partySize!<=layout.tables[o.tableId!].seats);
 }
});
test("takeout has zero dining tables and renders collection shelves instead", () => {
  const c = { ...presets.takeout.config, tables: 0 };
  assert.equal(diningTableCount(c), 0);
  assert.equal(restaurantLayout(c).tables.length, 0);
  const markup = renderToStaticMarkup(
    createElement(RestaurantFloor, {
      config: c,
      frame: emptyFrame,
      playing: false,
    }),
  );
  assert.ok(markup.includes('data-pickup-area="true"'));
  assert.ok(!markup.includes("data-dining-table="));
  assert.ok(!markup.includes("DINING ROOM"));
  assert.ok(markup.includes("ORDER COLLECTION"));
});
test("80 tables with 320 seats generates 80 distinct rendered tables in an expanded floor", () => {
  const c = { ...presets.large.config, tables: 80, seats: 320 },
    layout = restaurantLayout(c);
  validatePhysicalLayout(c.preset, c.seats, c.tables, c.stations);
  assert.equal(layout.tables.length, 80);
  assert.equal(
    layout.tables.reduce((sum, t) => sum + t.seats, 0),
    320,
  );
  assert.equal(new Set(layout.tables.map((t) => `${t.x},${t.y}`)).size, 80);
  assert.ok(layout.width > 840);
  assert.ok(layout.height > 460);
  for (const t of layout.tables) {
    assert.ok(t.x > 350 && t.x + 40 < layout.width - 25);
    assert.ok(t.y > 80 && t.y + 40 < layout.height - 90);
  }
  const markup = renderToStaticMarkup(
    createElement(RestaurantFloor, {
      config: c,
      frame: emptyFrame,
      playing: false,
    }),
  );
  assert.equal((markup.match(/data-dining-table=/g) ?? []).length, 80);
  assert.ok(markup.includes("80 tables · 320 seats"));
});
test("500-table maximum has no omitted or overlapping table positions", () => {
  const plan = restaurantLayout({
    ...presets.large.config,
    tables: 500,
    seats: 2000,
  });
  assert.equal(plan.tables.length, 500);
  assert.equal(new Set(plan.tables.map((t) => `${t.x},${t.y}`)).size, 500);
  validatePhysicalLayout("large", 2000, 500, 12);
  assert.throws(() => validatePhysicalLayout("large", 2004, 501, 12));
});
test("physical layout is required manual information and invalid capacities are blocked", () => {
  assert.throws(() => validatePhysicalLayout("", NaN, NaN, NaN));
  assert.throws(() => validatePhysicalLayout("large", 100.5, 80, 8));
  validatePhysicalLayout("", 0, 0, 4);
  const markup = renderToStaticMarkup(
    createElement(ManualLayout, {
      seats: NaN,
      stations: NaN,
      onSeats: noop,
      onStations: noop,
    }),
  );
  assert.ok(!markup.includes("Restaurant type"));
  assert.ok(!markup.includes("Number of dining tables"));
  assert.ok(markup.includes("Kitchen stations"));
  assert.ok(markup.includes("Number of seats"));
  assert.ok(!markup.includes('value="32"'));
});
test("simulation reserves actual table IDs and physical table count limits seating", () => {
  const c = {
      ...presets.large.config,
      tables: 80,
      seats: 320,
      cooks: 12,
      servers: 12,
      stations: 12,
      orders: 600,
      hours: 6,
    },
    large = simulate(c),
    small = simulate({ ...c, seats: 8 });
  assert.ok(large.completed > small.completed);
  for (const f of large.frames) {
    assert.ok(f.seated <= 80);
    assert.equal(new Set(f.occupiedTables).size, f.occupiedTables?.length);
  }
  for (const o of large.orders.filter((o) => o.tableId !== undefined)) {
    assert.ok(o.tableId! >= 0 && o.tableId! < 80);
  }
  assert.deepEqual(
    simulate({ ...c, tables: 2 }).orders,
    large.orders,
    "legacy table overrides cannot change the four-seat layout",
  );
});
test("supplier editor contains one unit price and no historical-price fields", () => {
  const markup = renderToStaticMarkup(
    createElement(CostEditor, {
      vendors: demoVendors,
      fixed: demoFixedCosts,
      onVendors: noop,
      onFixed: noop,
    }),
  );
  assert.ok(markup.includes("Price $ / unit"));
  assert.ok(!/previous|price increase/i.test(markup));
});
test("review keeps physical capacity outside the DoorDash data section", () => {
  const markup = renderToStaticMarkup(
    createElement(RestaurantReview, {
      preset: "large",
      opening: 11,
      closing: 21,
      orders: 300,
      seats: 320,
      tables: 80,
      stations: 8,
      menu: importedMenu,
      inventory: "500",
      staffCount: 8,
      onBack: noop,
      onContinue: noop,
    }),
  );
  const manual = markup.indexOf("Your restaurant layout &amp; operations");
  assert.ok(manual > 0);
  assert.ok(!markup.slice(0, manual).includes("80 tables"));
  assert.ok(markup.slice(manual).includes("80 tables · 320 seats"));
  assert.ok(markup.slice(manual).includes("Entered by you"));
});
