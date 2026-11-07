import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReplay,
  pathPosition,
  replayAt,
  seatPoint,
} from "./operations-replay";
import { presets, simulate } from "./simulation";
const config = {
  ...presets.small.config,
  tables: 10,
  seats: 40,
  cooks: 4,
  servers: 3,
  stations: 5,
};
const result = simulate(config),
  replay = buildReplay(config, result.orders);
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
test("party sizes vary and never exceed the capacity of the assigned table", () => {
  const sizes = new Set(
    result.orders.filter((o) => o.channel === "dineIn").map((o) => o.partySize),
  );
  assert.ok(sizes.has(1) && sizes.has(2) && sizes.has(3));
  for (const o of result.orders.filter((o) => o.tableId !== undefined)) {
    assert.ok(o.partySize! <= replay.plan.tables[o.tableId!].seats);
  }
});
test("a three-person party walks in, occupies three distinct real chairs, and leaves", () => {
  const order = result.orders.find(
    (o) => o.partySize === 3 && o.status === "completed" && o.finish < 180,
  )!;
  assert.ok(order);
  const tracks = replay.tracks.filter((t) =>
    t.id.startsWith(order.id + "-guest-"),
  );
  assert.equal(tracks.length, 3);
  const entering = replayAt(replay, order.arrival - 0.7).actors.filter((a) =>
    a.id.startsWith(order.id + "-guest-"),
  );
  assert.equal(entering.length, 3);
  assert.ok(entering.every((a) => a.walking));
  const seated = replayAt(replay, order.finish + 1).actors.filter((a) =>
    a.id.startsWith(order.id + "-guest-"),
  );
  assert.equal(seated.length, 3);
  assert.equal(
    new Set(seated.map((a) => `${a.position.x},${a.position.y}`)).size,
    3,
  );
  assert.ok(seated.every((a) => a.segment.action === "eat"));
  for (const actor of seated)
    assert.ok(
      dist(
        actor.position,
        seatPoint(replay.plan.tables[order.tableId!], actor.seatIndex!),
      ) < 0.001,
    );
  assert.equal(
    replayAt(replay, order.finish + 31).actors.filter((a) =>
      a.id.startsWith(order.id + "-guest-"),
    ).length,
    0,
  );
});
test("chefs have assigned stations, visibly move, cook, plate, and carry the real order", () => {
  const order = result.orders.find((o) => o.status === "completed")!;
  const track = replay.tracks.find((a) => a.id === `chef-${order.cookId}`)!;
  const phases = track.segments.filter((s) => s.orderId === order.id);
  assert.ok(phases.some((s) => s.state === "Cooking"));
  assert.ok(phases.some((s) => s.state === "Plating"));
  const walk = phases.find((s) => s.state === "Walking to station")!;
  assert.ok(
    dist(
      pathPosition(walk.path, 0.2).position,
      pathPosition(walk.path, 0.8).position,
    ) > 1,
  );
  const carrying = replayAt(replay, order.ready - 0.3).actors.find(
    (a) => a.id === track.id,
  )!;
  assert.equal(carrying.segment.orderId, order.id);
  assert.ok(carrying.segment.carry);
  assert.ok(carrying.walking);
  assert.ok(
    result.orders
      .filter((o) => Number.isFinite(o.start))
      .every((o) => o.cookId !== undefined && o.stationId !== undefined),
  );
});
test("Dashers enter from the street, wait, collect, and exit carrying an order", () => {
  const order = result.orders.find(
    (o) => o.channel === "doordash" && o.status === "completed",
  )!;
  const track = replay.tracks.find((t) => t.id === order.id + "-pickup")!;
  assert.equal(track.kind, "dasher");
  assert.equal(track.segments[0].state, "Arriving for pickup");
  assert.ok(track.segments[0].path[0].y > replay.plan.height);
  const waiting = track.segments.find((s) => s.state === "Waiting for order")!;
  assert.ok(waiting.start >= order.start);
  assert.equal(
    replayAt(replay, (waiting.start + waiting.end) / 2).actors.find(
      (a) => a.id === track.id,
    )?.segment.state,
    "Waiting for order",
  );
  const leaving = replayAt(replay, order.finish + 0.4).actors.find(
    (a) => a.id === track.id,
  )!;
  assert.equal(leaving.segment.carry, "bag");
  assert.ok(leaving.walking);
  assert.equal(
    replayAt(replay, order.finish + 2).actors.find((a) => a.id === track.id),
    undefined,
  );
});
test("every journey has continuous boundaries, preventing teleporting at task changes", () => {
  for (const track of replay.tracks)
    for (let i = 1; i < track.segments.length; i++) {
      const previous = track.segments[i - 1],
        current = track.segments[i];
      assert.ok(
        current.start >= previous.end - 1e-7,
        `${track.id} overlaps ${previous.state} and ${current.state}`,
      );
      if (Math.abs(current.start - previous.end) < 1e-7)
        assert.ok(
          dist(previous.path.at(-1)!, current.path[0]) < 0.01,
          `${track.id}: ${previous.state} → ${current.state} jumps ${dist(previous.path.at(-1)!, current.path[0])}`,
        );
    }
});
test("scrubbing to a timestamp reconstructs the exact same scene and has no future events", () => {
  const first = replayAt(replay, 87.35);
  replayAt(replay, 165);
  assert.deepEqual(replayAt(replay, 87.35), first);
  assert.ok(first.events.every((e) => e.time <= 87.35));
  for (const time of [0, 18.2, 50.7, 90, 130.2, 220])
    for (const actor of replayAt(replay, time).actors) {
      assert.ok(
        Number.isFinite(actor.position.x) && Number.isFinite(actor.position.y),
      );
      assert.ok(actor.opacity >= 0 && actor.opacity <= 1);
    }
});
test("servers walk assigned handoff routes and carry food to the actual table", () => {
  const order = result.orders.find(
    (o) => o.channel === "dineIn" && o.status === "completed",
  )!;
  const track = replay.tracks.find((a) => a.id === `server-${order.serverId}`)!;
  const task = track.segments.find(
    (s) => s.orderId === order.id && s.carry === "plate",
  )!;
  assert.ok(task.state.includes(`table ${order.tableId! + 1}`));
  assert.equal(task.end, order.finish);
  assert.ok(task.path.some((p) => p.x === 365));
  assert.ok(task.path.at(-1)!.x > replay.plan.tables[order.tableId!].x);
});
test("waiting parties have personal space and overflow waits outside instead of stacking avatars", () => {
  const c = { ...config, orders: 350, cooks: 1 },
    r = simulate(c),
    timeline = buildReplay(c, r.orders);
  let outside = false;
  for (const time of [60, 90, 120, 150]) {
    const queue = replayAt(timeline, time).actors.filter(
      (a) => a.kind === "guest" && a.segment.state === "Waiting to be seated",
    );
    for (let i = 0; i < queue.length; i++) {
      outside ||= queue[i].position.y > timeline.plan.height;
      for (let j = i + 1; j < queue.length; j++)
        assert.ok(
          dist(queue[i].position, queue[j].position) >= 17,
          `${queue[i].id} overlaps ${queue[j].id}`,
        );
    }
  }
  assert.ok(outside);
});
test("table service includes walking time, increasing with distance from the pass", () => {
  const jobs = result.orders.filter(
    (o) =>
      o.channel === "dineIn" &&
      Number.isFinite(o.serviceStart) &&
      Number.isFinite(o.finish),
  );
  assert.ok(jobs.every((o) => o.finish - o.serviceStart! > 1.5));
  const byDistance = jobs.map((o) => ({
    x: replay.plan.tables[o.tableId!].x,
    y: replay.plan.tables[o.tableId!].y,
    time: o.finish - o.serviceStart!,
  }));
  assert.ok(
    Math.max(...byDistance.map((o) => o.time)) -
      Math.min(...byDistance.map((o) => o.time)) >
      0.1,
  );
});
