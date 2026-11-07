import test from "node:test";
import assert from "node:assert/strict";
import {
  channelMix,
  experiments,
  exportCSV,
  presets,
  simulate,
  validateConfig,
} from "./simulation";
test("identical seeds and configuration produce identical complete runs", () => {
  assert.deepEqual(
    simulate(presets.small.config),
    simulate(presets.small.config),
  );
  assert.notDeepEqual(
    simulate(presets.small.config).orders,
    simulate({ ...presets.small.config, seed: 43 }).orders,
  );
});
test("preset channel mix and drive-through reallocation preserve 100%", () => {
  for (const p of Object.values(presets)) {
    for (const driveThrough of [false, true]) {
      const mix = channelMix({ ...p.config, driveThrough, driveShare: 30 });
      assert.ok(
        Math.abs(Object.values(mix).reduce((a, b) => a + b, 0) - 1) < 1e-10,
      );
      assert.equal(mix.driveThrough, driveThrough ? 0.3 : 0);
    }
    const r = simulate(p.config);
    assert.equal(
      Object.values(r.channels).reduce((a, b) => a + b, 0),
      r.orders.length,
    );
  }
  assert.equal(simulate(presets.takeout.config).channels.dineIn, 0);
});
test("every order has exactly one outcome and finances reconcile including waste", () => {
  for (const p of Object.values(presets)) {
    const r = simulate(p.config);
    assert.equal(r.completed + r.lost + r.unfinished, r.orders.length);
    assert.equal(r.profit, r.revenue - r.food - r.fees - r.labor - r.overhead);
    assert.equal(r.frames.at(-1)?.completed, r.completed);
    assert.equal(r.frames.at(-1)?.lost, r.lost);
    assert.ok(r.utilization >= 0 && r.utilization <= 1);
    assert.equal(
      r.revenue,
      r.orders
        .filter((o) => o.status === "completed")
        .reduce((s, o) => s + o.subtotal, 0),
    );
    assert.ok(
      r.orders
        .filter((o) => o.channel !== "doordash")
        .every((o) => o.fee === 0),
    );
  }
});
test("one added cook improves the busy default; cutting a cook harms it", () => {
  const c = { ...presets.small.config, seats: 80 },
    b = simulate(c),
    up = simulate({ ...c, cooks: 3 }),
    down = simulate({ ...c, cooks: 1 });
  assert.ok(up.profit > b.profit, `${up.profit} > ${b.profit}`);
  assert.ok(up.completed > b.completed);
  assert.ok(up.averageWait < b.averageWait);
  assert.equal(up.labor - b.labor, c.wage * c.hours);
  assert.ok(down.profit < b.profit);
  assert.ok(down.completed < b.completed);
  assert.ok(down.averageWait > b.averageWait);
});
test("station bottleneck caps throughput even when more cooks are hired", () => {
  const c = { ...presets.takeout.config, stations: 1 };
  const a = simulate(c),
    b = simulate({ ...c, cooks: 5 });
  assert.equal(a.completed, b.completed);
  assert.equal(a.averageWait, b.averageWait);
  assert.ok(b.profit < a.profit);
});
test("kitchen never has more active orders than cook/station capacity", () => {
  const c = presets.small.config,
    r = simulate(c);
  for (const frame of r.frames) {
    assert.ok(frame.cooking <= Math.min(c.cooks, c.stations));
    assert.ok(frame.seated <= Math.floor(c.seats / 2));
  }
});
test("shared random inputs make baseline and staffing scenarios comparable", () => {
  const a = simulate(presets.small.config),
    b = simulate({ ...presets.small.config, cooks: 3 });
  assert.deepEqual(
    a.orders.map((o) => [o.id, o.arrival, o.prep, o.subtotal, o.channel]),
    b.orders.map((o) => [o.id, o.arrival, o.prep, o.subtotal, o.channel]),
  );
});
test("recommendations use engine deltas and contain beneficial and harmful experiments", () => {
  const c = presets.small.config,
    b = simulate(c),
    ideas = experiments(c);
  assert.ok(ideas.some((x) => x.delta > 0));
  assert.ok(ideas.some((x) => x.delta < 0));
  for (const x of ideas) assert.equal(x.delta, x.result.profit - b.profit);
  assert.equal(ideas[0].delta, Math.max(...ideas.map((x) => x.delta)));
});
test("extreme supported inputs stay finite and order count responds to price/demand", () => {
  const c = presets.small.config;
  assert.ok(
    simulate({ ...c, demandChange: 100 }).orders.length >
      simulate(c).orders.length,
  );
  assert.ok(
    simulate({ ...c, priceChange: 30 }).orders.length <
      simulate(c).orders.length,
  );
  for (const options of [
    { orders: 10, cooks: 12, hours: 1 },
    { orders: 1000, cooks: 1, hours: 12 },
  ]) {
    const r = simulate({ ...c, ...options });
    assert.ok(Number.isFinite(r.profit));
    assert.ok(Number.isFinite(r.averageWait));
  }
});
test("invalid imports are rejected", () => {
  for (const change of [
    { cooks: 0 },
    { wage: NaN },
    { orders: 2.5 },
    { driveShare: 100 },
    { preset: "invalid" },
    { driveThrough: "yes" },
    { seats: 3.5 },
  ])
    assert.throws(() =>
      validateConfig({
        ...presets.small.config,
        ...change,
      } as typeof presets.small.config),
    );
});
test("CSV is portable and includes every generated order", () => {
  const r = simulate(presets.small.config),
    csv = exportCSV(r);
  assert.equal(csv.split("\n").length, r.orders.length + 1);
  assert.ok(!csv.includes("Infinity"));
  assert.equal(csv.split("\n")[0].split(",").length, 9);
});
