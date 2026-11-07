import type { Config, Order } from "./simulation";
import { restaurantLayout } from "./restaurant-layout";
import { staffingSlots, StaffRole, StaffSlot } from "./staffing";
type Booking = { start: number; end: number };
type Resource = {
  start: number;
  end: number;
  jobs: Booking[];
  person?: StaffSlot;
  index: number;
};
function gap(r: Resource, at: number, length: number) {
  let start = Math.max(r.start, at);
  for (const job of r.jobs) {
    if (start + length <= job.start) break;
    if (start < job.end) start = job.end;
  }
  return start + length <= r.end ? start : Infinity;
}
function reserve(r: Resource, start: number, length: number) {
  r.jobs.push({ start, end: start + length });
  r.jobs.sort((a, b) => a.start - b.start);
}
function best(resources: Resource[], at: number, length: number) {
  let winner: Resource | undefined,
    time = Infinity;
  for (const r of resources) {
    const t = gap(r, at, length);
    if (t < time) {
      time = t;
      winner = r;
    }
  }
  return { resource: winner, time };
}
export function scheduleOperations(c: Config, orders: Order[]) {
  const duration = c.hours * 60,
    slots = staffingSlots(c),
    resources = slots.map(
      (s) =>
        ({
          start: s.start * 60,
          end: s.end * 60,
          jobs: [],
          person: s,
          index: s.index,
        }) as Resource,
    ),
    cooks = resources.filter((r) => r.person?.group === "cook"),
    front = resources.filter((r) => r.person?.group === "front"),
    back = resources.filter((r) => r.person?.group === "back"),
    stations = Array.from({ length: c.stations }, (_, index): Resource => ({
      start: 0,
      end: duration,
      jobs: [],
      index,
    })),
    plan = restaurantLayout(c),
    tables = plan.tables.map(() => 0);
  const roles = (pool: Resource[], allowed: StaffRole[]) =>
    pool.filter((r) => allowed.includes(r.person!.role));
  let stock = c.inventory ?? Infinity,
    busy = 0,
    drive = 0;
  for (const o of orders) {
    const quantity = o.quantity ?? 1;
    if (stock < quantity) {
      o.status = "lost";
      o.stockout = true;
      o.finish = o.arrival;
      continue;
    }
    const eligible=tables.map((at,i)=>plan.tables[i].seats>=(o.partySize??1)?at:Infinity);
    const table =
      o.channel === "dineIn" ? eligible.indexOf(Math.min(...eligible)) : -1;
    const eligibleAt = Math.max(o.arrival, table < 0 ? 0 : tables[table]);
    const support = best(roles(back, ["prep"]), eligibleAt, 1);
    const supported = !!support.resource && support.time + 1 <= eligibleAt + 3;
    const earliest = supported ? support.time + 1 : eligibleAt;
    const washers = roles(back, ["dishwasher"]).filter(
      (r) => r.start <= earliest && r.end > earliest,
    ).length;
    const prep = o.prep * (supported ? 0.78 : 1) * (1 + 0.12 / (1 + washers));
    let cook: Resource | undefined,
      station: Resource | undefined,
      start = Infinity;
    for (const chef of cooks)
      for (const counter of stations) {
        let t = earliest;
        for (let i = 0; i < chef.jobs.length + counter.jobs.length + 3; i++) {
          const next = Math.max(gap(chef, t, prep), gap(counter, t, prep));
          if (next === t || !Number.isFinite(next)) {
            t = next;
            break;
          }
          t = next;
        }
        if (t < start) {
          start = t;
          cook = chef;
          station = counter;
        }
      }
    if (
      !cook ||
      !station ||
      start - o.arrival > o.patience ||
      (o.channel === "dineIn" && start >= (c.diningEnd ?? c.hours) * 60)
    ) {
      o.finish = Math.min(duration, o.arrival + o.patience);
      o.wait = o.finish - o.arrival;
      o.status = o.arrival + o.patience <= duration ? "lost" : "unfinished";
      continue;
    }
    if (supported && support.resource) {
      reserve(support.resource, support.time, 1);
      o.prepSupportStart = support.time;
      o.prepSupportEnd = support.time + 1;
      o.prepBackIndex = support.resource.index;
    }
    o.start = start;
    o.ready = start + prep;
    o.cookId = cook.index;
    o.stationId = station.index;
    o.prep = prep;
    stock -= quantity;
    reserve(cook, start, prep);
    reserve(station, start, prep);
    busy += prep;
    if (table >= 0) o.tableId = table;
    const target = table >= 0 ? plan.tables[table] : undefined;
    const length = target
      ? 1.5 +
        (Math.abs(target.y + 52 - 225) + Math.abs(target.x + 54 - 365) + 130) /
          240
      : 2;
    const allowed: StaffRole[] =
      o.channel === "dineIn"
        ? ["front", "waiter"]
        : o.channel === "driveThrough"
          ? ["front", "cashier", "driveThrough"]
          : ["front", "cashier"];
    const handoff = best(
      roles(front, allowed),
      Math.max(o.ready, o.channel === "driveThrough" ? drive : 0),
      length,
    );
    if (handoff.resource) {
      o.serverId = handoff.resource.index;
      o.serviceStart = handoff.time;
      o.finish = handoff.time + length;
      reserve(handoff.resource, handoff.time, length);
      if (o.channel === "driveThrough") drive = o.finish;
    }
    o.wait = Math.min(duration, o.finish) - o.arrival;
    o.status =
      o.finish > duration
        ? "unfinished"
        : o.wait > o.patience + 12
          ? "lost"
          : "completed";
    if (o.status === "completed")
      o.fee = o.channel === "doordash" ? o.subtotal * c.fee : 0;
    if (table >= 0) {
      const departure =
        o.status === "completed" ? o.finish + 28 : Math.min(duration, o.finish);
      const dedicated = best(roles(front, ["busser"]), departure, 1.4),
        fallback = best(roles(front, ["waiter", "front"]), departure, 2.5);
      const bus =
        dedicated.time + 1.4 <= fallback.time + 2.5
          ? { ...dedicated, length: 1.4 }
          : { ...fallback, length: 2.5 };
      if (bus.resource) {
        o.busStart = bus.time;
        o.busFinish = bus.time + bus.length;
        o.busStaffIndex = bus.resource.index;
        reserve(bus.resource, bus.time, bus.length);
      }
      o.tableReadyAt = bus.resource ? o.busFinish : Infinity;
      tables[table] = o.tableReadyAt!;
    }
    const wash = best(
      roles(back, ["dishwasher"]),
      table >= 0 ? (o.busFinish ?? Infinity) : o.ready,
      quantity * 0.5,
    );
    if (wash.resource) {
      o.washStart = wash.time;
      o.washEnd = wash.time + quantity * 0.5;
      o.washBackIndex = wash.resource.index;
      reserve(wash.resource, wash.time, quantity * 0.5);
    }
  }
  return busy;
}
