import test from "node:test";
import assert from "node:assert/strict";
import {
  customerHappiness,
  forecastDemand,
  presets,
  simulate,
} from "./simulation";
import {
  moreProfitable,
  optimizeScenario,
  preservePay,
  scenarioCandidates,
  ScenarioChoice,
} from "./scenario-optimizer";
test("higher prices lower demand and discounts increase demand in both directions", () => {
  const c = presets.small.config;
  assert.ok(
    forecastDemand({ ...c, priceChange: 20 }).orders < forecastDemand(c).orders,
  );
  assert.ok(
    forecastDemand({ ...c, priceChange: -20 }).orders >
      forecastDemand(c).orders,
  );
  assert.equal(forecastDemand({ ...c, priceChange: 10 }).priceMultiplier, 0.93);
});
test("happiness falls with waiting and price increases, and improves with discounts", () => {
  assert.ok(
    customerHappiness(30, 0, "completed") <
      customerHappiness(12, 0, "completed"),
  );
  assert.ok(
    customerHappiness(20, 20, "completed") <
      customerHappiness(20, 0, "completed"),
  );
  assert.ok(
    customerHappiness(20, -20, "completed") >
      customerHappiness(20, 0, "completed"),
  );
  for (const wait of [0, 20, 1000])
    for (const price of [-30, 0, 50])
      for (const status of ["completed", "lost", "unfinished"] as const) {
        const score = customerHappiness(wait, price, status);
        assert.ok(score >= 1 && score <= 5);
      }
});
test("overall rating includes customers whose orders were lost or unfinished", () => {
  const r = simulate({ ...presets.small.config, cooks: 1 });
  assert.ok(r.lost > 0);
  assert.equal(
    r.happiness,
    r.orders.reduce((sum, o) => sum + o.happiness!, 0) / r.orders.length,
  );
  const fulfilled = r.orders.filter((o) => o.status === "completed");
  assert.ok(
    r.happiness <
      fulfilled.reduce((sum, o) => sum + o.happiness!, 0) / fulfilled.length,
  );
  const stockedOut = simulate({ ...presets.small.config, inventory: 0 });
  assert.ok(stockedOut.happiness <= 2);
  assert.ok(stockedOut.orders.every((o) => o.happiness! <= 2));
});
test("isolated low-load scenarios show the price effect in the final happiness rating", () => {
  const c = {
    ...presets.takeout.config,
    orders: 20,
    cooks: 4,
    servers: 4,
    stations: 4,
    hours: 8,
  };
  const discounted = simulate({ ...c, priceChange: -20 }),
    regular = simulate(c),
    premium = simulate({ ...c, priceChange: 20 });
  assert.ok(discounted.happiness > regular.happiness);
  assert.ok(premium.happiness < regular.happiness);
  assert.ok(discounted.orders.length > regular.orders.length);
});
test("frame-free optimization runs preserve every outcome and metric", () => {
  for (const preset of Object.values(presets)) {
    const full = simulate(preset.config),
      fast = simulate(preset.config, { includeFrames: false });
    assert.deepEqual(fast.frames, []);
    assert.deepEqual({ ...full, frames: [] }, fast);
  }
});
test("pay is restored from recorded baseline data without mutating either input", () => {
  const base = {
    ...presets.small.config,
    staff: [
      { name: "Chef", role: "cook" as const, start: 0, end: 4, pay: 24 },
      { name: "Server", role: "front" as const, start: 0, end: 4, pay: 18 },
    ],
  };
  const changed = {
    ...base,
    wage: 1,
    cooks: 3,
    staff: base.staff.map((s) => ({ ...s, pay: 1 })),
  };
  const locked = preservePay(base, changed);
  assert.equal(locked.wage, base.wage);
  assert.deepEqual(locked.staff, base.staff);
  assert.equal(locked.cooks, 3);
  assert.equal(changed.staff[0].pay, 1);
  assert.notEqual(locked.staff, base.staff);
});
test("profit ranks first and the shortest fulfilled-order wait breaks equal-cent profit ties", () => {
  const c = presets.small.config,
    r = simulate(c);
  const a: ScenarioChoice = { config: c, result: r },
    b: ScenarioChoice = {
      config: c,
      result: { ...r, averageWait: r.averageWait - 1 },
    };
  assert.ok(moreProfitable(b, a));
  assert.ok(!moreProfitable(a, b));
  assert.ok(
    moreProfitable(
      {
        ...a,
        result: { ...r, profit: r.profit + 1, averageWait: r.averageWait + 10 },
      },
      b,
    ),
  );
  assert.ok(
    !moreProfitable(
      { ...a, result: { ...r, completed: 0, averageWait: 0 } },
      a,
    ),
  );
});
test("Ask Sous selects the maximum tested profit and keeps non-decision assumptions fixed", () => {
  const c = presets.small.config,
    options = { cooks: [1, 2, 3], servers: [1, 2, 3], prices: [-10, 0, 10] },
    before = structuredClone(c),
    progress: number[] = [];
  const solved = optimizeScenario(c, {
      ...options,
      onProgress: (done) => progress.push(done),
    }),
    choices = scenarioCandidates(c, options).configs.map((config) => ({
      config,
      result: simulate(config, { includeFrames: false }),
    }));
  for (const choice of choices) assert.ok(!moreProfitable(choice, solved.best));
  assert.ok(solved.best.result.profit >= simulate(c).profit - 0.005);
  assert.equal(solved.tested, 27);
  assert.equal(progress.at(-1), 27);
  for (const key of [
    "wage",
    "hours",
    "demandChange",
    "stations",
    "seats",
    "inventory",
  ] as const)
    assert.equal(solved.best.config[key], c[key]);
  assert.deepEqual(c, before);
  assert.deepEqual(optimizeScenario(c, options), optimizeScenario(c, options));
});
test("shortest-wait alternative preserves starting throughput and never calls zero fulfilled a fast result", () => {
  const c = presets.small.config,
    baseline = simulate(c),
    solved = optimizeScenario(c, {
      cooks: [1, 2, 3, 4],
      servers: [1, 2, 3],
      prices: [0, 10],
    });
  assert.ok(solved.fastest.result.completed >= baseline.completed);
  assert.ok(solved.fastest.result.averageWait <= baseline.averageWait);
  assert.ok(solved.fastest.result.completed > 0);
});
test("a default search includes all staffing choices and the current menu price", () => {
  const c = { ...presets.small.config, priceChange: 8 },
    domain = scenarioCandidates(c);
  assert.equal(domain.configs.length, 12 * 12 * 12);
  assert.ok(domain.prices.includes(8));
  assert.equal(Math.min(...domain.configs.map((c) => c.cooks)), 1);
  assert.equal(Math.max(...domain.configs.map((c) => c.servers)), 12);
  assert.throws(() => scenarioCandidates(c, { prices: [] }));
});
