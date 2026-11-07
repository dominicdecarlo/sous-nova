import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { presets, simulate, validateConfig, Config } from "./simulation";
import { toggleDrive, driveCoverage, serviceQuality } from "./service-quality";
import { withStaffPlan } from "./staffing";
import { buildReplay, replayAt } from "./operations-replay";
import DriveVehicle, { vehicleType } from "../app/drive-vehicle";
const base = (): Config =>
  withStaffPlan({ ...presets.takeout.config, orders: 100, hours: 4 }, [
    { id: "cook", role: "cook", count: 5, start: 0, end: 4 },
    { id: "front", role: "front", count: 2, start: 0, end: 4 },
  ]);
test("drive toggle adds required coverage and gaps are rejected", () => {
  const c = toggleDrive(base(), true);
  assert.ok(driveCoverage(c));
  validateConfig(c);
  assert.equal(c.staffPlan!.filter((s) => s.role === "driveThrough").length, 1);
  const bad = withStaffPlan(
    c,
    c.staffPlan!.filter((s) => s.role !== "driveThrough"),
  );
  assert.throws(() => simulate(bad), /covering all store hours/);
  const gap = withStaffPlan(c, [
    ...bad.staffPlan!,
    { id: "one", role: "prep", count: 1, start: 0, end: 1 },
    { id: "two", role: "dishwasher", count: 1, start: 2, end: 4 },
  ]);
  assert.ok(!driveCoverage(gap));
});
test("backroom staff can serve the lane without a dedicated drive worker", () => {
  const c = withStaffPlan({ ...base(), driveThrough: true, driveShare: 60 }, [
    ...base().staffPlan!,
    { id: "back", role: "dishwasher", count: 2, start: 0, end: 4 },
  ]);
  validateConfig(c);
  const r = simulate(c);
  assert.ok(
    r.orders.some(
      (o) =>
        o.channel === "driveThrough" &&
        o.status === "completed" &&
        o.driveBackIndex !== undefined,
    ),
  );
  const replay = buildReplay(c, r.orders);
  assert.ok(
    replay.tracks.some(
      (t) =>
        t.kind === "backroom" &&
        t.segments.some((s) => s.state === "Serving drive-through"),
    ),
  );
});
test("drive orders generate deterministic varied vehicles with actual arrival and departure journeys", () => {
  const c = { ...toggleDrive(base(), true), driveShare: 70 },
    r = simulate(c),
    replay = buildReplay(c, r.orders),
    cars = replay.tracks.filter((t) => t.kind === "car");
  assert.ok(cars.length > 20);
  assert.equal(new Set(cars.map((t) => vehicleType(t.id))).size, 3);
  const paints = new Set<string>();
  for (const car of cars.slice(0, 30)) {
    assert.ok(car.segments.some((s) => s.state === "Joining drive-through"));
    assert.ok(car.segments.some((s) => s.state === "Departing"));
    const time = (car.segments[0].start + car.segments[0].end) / 2,
      actor = replayAt(replay, time).actors.find((a) => a.id === car.id)!;
    const svg = renderToStaticMarkup(createElement(DriveVehicle, { actor }));
    assert.ok(svg.includes(`data-vehicle-type="${vehicleType(car.id)}"`));
    paints.add(svg.match(/data-vehicle-color="(#[a-f0-9]{6})"/)![1]);
  }
  assert.ok(paints.size > 1);
  assert.equal(
    buildReplay(base(), simulate(base()).orders).tracks.filter(
      (t) => t.kind === "car",
    ).length,
    0,
  );
});
test("bussers and dishwashers improve completed-customer happiness with bounded effects", () => {
  const c = base(),
    o = {
      ...simulate(c).orders[0],
      status: "completed" as const,
      channel: "dineIn" as const,
      arrival: 60,
    };
  const supported = withStaffPlan(c, [
    ...c.staffPlan!,
    { id: "bus", role: "busser", count: 1, start: 0, end: 4 },
    { id: "wash", role: "dishwasher", count: 1, start: 0, end: 4 },
  ]);
  assert.ok(serviceQuality(supported, o) > serviceQuality(c, o));
  assert.equal(serviceQuality(supported, { ...o, status: "lost" }), 0);
  assert.equal(serviceQuality(supported, o), 0.35);
  assert.ok(serviceQuality(supported, { ...o, channel: "pickup" }) < 0.35);
});
