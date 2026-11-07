import type { Config, Order } from "./simulation";
import { restaurantLayout } from "./restaurant-layout";
import { staffingSlots, roleLabels } from "./staffing";
export type Point = { x: number; y: number };
export type ActorKind =
  "chef" | "server" | "backroom" | "guest" | "dasher" | "pickup" | "car";
export type Segment = {
  start: number;
  end: number;
  path: Point[];
  state: string;
  orderId?: string;
  carry?: "plate" | "bag";
  action?: "chop" | "plate" | "clean" | "eat";
};
export type ActorTrack = {
  id: string;
  name: string;
  kind: ActorKind;
  color: string;
  skin: string;
  segments: Segment[];
  tableId?: number;
  seatIndex?: number;
};
export type ReplayActor = ActorTrack & {
  position: Point;
  angle: number;
  walking: boolean;
  opacity: number;
  segment: Segment;
  progress: number;
};
export type ReplayEvent = {
  time: number;
  label: string;
  kind: ActorKind | "order";
  id: string;
};
export type Replay = ReturnType<typeof buildReplay>;
export const hash = (s: string) => {
  let n = 2166136261;
  for (const ch of s) n = Math.imul(n ^ ch.charCodeAt(0), 16777619);
  return n >>> 0;
};
const palette = [
  "#477c75",
  "#cc9877",
  "#6b83a0",
  "#9e86aa",
  "#bf9e58",
  "#719562",
];
const skins = ["#e1b993", "#bd8d6d", "#976c50", "#edcfac", "#c5a080"];
const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
export function pathPosition(path: Point[], progress: number) {
  const p = Math.max(0, Math.min(1, progress));
  const lengths = path.slice(1).map((v, i) => distance(path[i], v)),
    total = lengths.reduce((a, b) => a + b, 0);
  let left = total * p;
  for (let i = 0; i < lengths.length; i++) {
    if (left <= lengths[i] && lengths[i] > 0) {
      const f = left / lengths[i],
        point = {
          x: path[i].x + (path[i + 1].x - path[i].x) * f,
          y: path[i].y + (path[i + 1].y - path[i].y) * f,
        };
      return {
        position: point,
        angle:
          (Math.atan2(path[i + 1].y - path[i].y, path[i + 1].x - path[i].x) *
            180) /
          Math.PI,
        remaining: [point, ...path.slice(i + 1)],
        travelled: [...path.slice(0, i + 1), point],
      };
    }
    left -= lengths[i];
  }
  return {
    position: path.at(-1) ?? { x: 0, y: 0 },
    angle: 0,
    remaining: [path.at(-1) ?? { x: 0, y: 0 }],
    travelled: path,
  };
}
export function seatPoint(
  table: { x: number; y: number; seats: number },
  seat: number,
): Point {
  const angle = (seat / table.seats) * Math.PI * 2;
  return {
    x: table.x + Math.cos(angle) * 35,
    y: table.y + Math.sin(angle) * 35,
  };
}
export function stationPoint(id: number) {
  return { x: 99 + (id % 2) * 103, y: 91 + Math.floor(id / 2) * 90 + 63 };
}
const same = (p: Point) => [p, p];
export function buildReplay(config: Config, orders: Order[]) {
  const roster = staffingSlots(config);
  const plan = restaurantLayout(config),
    duration = config.hours * 60,
    tracks: ActorTrack[] = [],
    events: ReplayEvent[] = [];
  const entrance = { x: plan.width - 105, y: plan.height - 38 },
    outside = { x: entrance.x, y: plan.height + 82 },
    foyer = plan.height - 78,
    pass = { x: 302, y: 225 },
    pickupPoint = { x: 398, y: plan.height - 125 };
  const tableRoute = (from: Point, tableId: number, seat: Point) => {
    const table = plan.tables[tableId];
    const row = table.y + 52;
    const side = seat.x < table.x - 10 ? table.x - 54 : table.x + 54;
    const outsideStart = from.y > plan.height - 37;
    const path = [
      from,
      ...(outsideStart ? [entrance, { x: entrance.x, y: foyer }] : []),
      { x: 365, y: outsideStart ? foyer : from.y },
      { x: 365, y: row },
      { x: side, y: row },
    ];
    if (seat.y < table.y - 10)
      path.push({ x: side, y: table.y - 52 }, { x: seat.x, y: table.y - 52 });
    else path.push({ x: side, y: seat.y });
    path.push(seat);
    return path;
  };
  const tableReturn = (from: Point, tableId: number) => {
    const table = plan.tables[tableId],
      side = from.x < table.x - 10 ? table.x - 54 : table.x + 54;
    return [
      from,
      { x: side, y: from.y },
      { x: side, y: table.y + 52 },
      { x: 365, y: table.y + 52 },
      { x: 365, y: 225 },
      { x: 330, y: 225 },
      pass,
    ];
  };
  const frontReturn = (from: Point, tableId?: number) =>
    tableId !== undefined
      ? tableReturn(from, tableId)
      : [
          from,
          { x: 358, y: pickupPoint.y },
          { x: 280, y: pickupPoint.y },
          { x: 280, y: 225 },
          pass,
        ];
  const queuePoint = (
    kind: "guest" | "dasher" | "pickup",
    rank: number,
    member = 0,
  ) => {
    if (kind === "guest") {
      const columns = Math.max(2, Math.floor((plan.width - 730) / 64) + 1),
        inside = columns * 2;
      if (rank < inside)
        return {
          x: plan.width - 170 - (rank % columns) * 64,
          y: plan.height - 92 - Math.floor(rank / columns) * 46,
        };
      const outer = rank - inside,
        streetColumns = Math.max(3, Math.floor((plan.width - 490) / 64) + 1);
      return {
        x: plan.width - 140 - (outer % streetColumns) * 64,
        y: plan.height + 25 + Math.floor(outer / streetColumns) * 42,
      };
    }
    if (rank < 8)
      return {
        x: 435 + (rank % 4) * 28,
        y: plan.height - 122 - Math.floor(rank / 4) * 28,
      };
    return {
      x: 80 + ((rank - 8) % 7) * 28,
      y: plan.height + 25 + Math.floor((rank - 8) / 7) * 28,
    };
  };
  function actor(
    id: string,
    name: string,
    kind: ActorKind,
    segments: Segment[],
    extra: Partial<ActorTrack> = {},
  ) {
    const n = hash(id);
    tracks.push({
      id,
      name,
      kind,
      color:
        kind === "chef"
          ? "#f5f1df"
          : kind === "server"
            ? "#47785e"
            : kind === "dasher"
              ? "#e96248"
              : palette[n % palette.length],
      skin: skins[n % skins.length],
      segments,
      ...extra,
    });
  }
  const addEvent = (
    time: number,
    label: string,
    kind: ReplayEvent["kind"],
    id: string,
  ) => {
    if (Number.isFinite(time) && time >= 0)
      events.push({ time, label, kind, id });
  };
  const named = (role: "cook" | "front", i: number) =>
    roster.find((s) => s.group === role && s.index === i)?.name ??
    `${role === "cook" ? "Chef" : "Server"} ${i + 1}`;
  function staffTrack(kind: "chef" | "server", index: number) {
    const person = roster.find(
      (s) =>
        s.group === (kind === "chef" ? "cook" : "front") && s.index === index,
    );
    const shiftStart = person ? person.start * 60 : 0,
      shiftEnd = person ? Math.min(duration, person.end * 60) : duration;
    if (shiftStart >= shiftEnd) return;
    const home =
      kind === "chef"
        ? { x: 267, y: 82 + index * 25 }
        : {
            x: 445 + (index % 4) * 22,
            y: plan.height - 175 + Math.floor(index / 4) * 20,
          };
    let cursor = shiftStart,
      position: Point = { x: 170 + index * 7, y: plan.height - 20 },
      returnPath: Point[] =
        kind === "server"
          ? [
              position,
              { x: 280, y: plan.height - 125 },
              { x: 430, y: plan.height - 125 },
              home,
            ]
          : [
              position,
              { x: 260, y: plan.height - 100 },
              { x: 260, y: home.y },
              home,
            ];
    const segments: Segment[] = [];
    const add = (
      start: number,
      end: number,
      path: Point[],
      state: string,
      extra: Partial<Segment> = {},
    ) => {
      if (end > start && Number.isFinite(start) && Number.isFinite(end))
        segments.push({ start, end, path, state, ...extra });
    };
    function idleUntil(until: number) {
      const gap = until - cursor;
      if (gap <= 0) return [position, ...returnPath.slice(1)];
      const travel = Math.min(0.9, gap),
        progress = travel / 0.9;
      const cut = pathPosition(returnPath, progress);
      add(cursor, cursor + travel, cut.travelled, "Returning to prep");
      if (gap < 0.9) {
        position = cut.position;
        returnPath = cut.remaining;
      } else {
        position = home;
        returnPath = [home];
        add(
          cursor + 0.9,
          until,
          same(home),
          kind === "chef"
            ? "Mise en place"
            : person
              ? `${roleLabels[person.role]} · available`
              : "Taking orders",
          { action: kind === "chef" ? "clean" : undefined },
        );
      }
      cursor = until;
      return [position, ...returnPath.slice(1)];
    }
    const jobs = orders
      .flatMap((o) => {
        const jobs: { o: Order; begin: number; end: number; bus: boolean }[] =
          [];
        if (kind === "chef" && o.cookId === index && Number.isFinite(o.start))
          jobs.push({ o, begin: o.start, end: o.ready, bus: false });
        if (
          kind === "server" &&
          o.serverId === index &&
          Number.isFinite(o.serviceStart) &&
          Number.isFinite(o.finish)
        )
          jobs.push({ o, begin: o.serviceStart!, end: o.finish, bus: false });
        if (
          kind === "server" &&
          o.busStaffIndex === index &&
          Number.isFinite(o.busStart)
        )
          jobs.push({ o, begin: o.busStart!, end: o.busFinish!, bus: true });
        return jobs;
      })
      .sort((a, b) => a.begin - b.begin);
    for (const { o, begin, end, bus } of jobs) {
      if (begin < shiftStart || begin >= shiftEnd) continue;
      const lead = idleUntil(begin);
      if (bus && o.tableId !== undefined) {
        const table = plan.tables[o.tableId],
          target = { x: table.x + 49, y: table.y + 20 },
          cleanAt = begin + (end - begin) * 0.65;
        add(
          begin,
          cleanAt,
          [...lead, ...tableRoute(position, o.tableId, target).slice(1)],
          `Walking to clear table ${o.tableId + 1}`,
          { orderId: o.id },
        );
        add(cleanAt, end, same(target), `Bussing table ${o.tableId + 1}`, {
          orderId: o.id,
          action: "clean",
        });
        position = target;
        returnPath = [...frontReturn(target, o.tableId), home];
        addEvent(
          end,
          `Table ${o.tableId + 1} cleaned and ready`,
          "server",
          `${o.id}-bussed`,
        );
      } else if (kind === "chef") {
        const station = stationPoint(o.stationId ?? 0),
          walkEnd = begin + Math.min(0.75, o.prep * 0.15),
          plateStart = Math.max(walkEnd, end - 2.1),
          carryStart = end - 1.4;
        add(
          begin,
          walkEnd,
          [...lead, { x: 260, y: station.y }, station],
          "Walking to station",
          { orderId: o.id },
        );
        add(walkEnd, plateStart, same(station), "Cooking", {
          orderId: o.id,
          action: "chop",
        });
        add(plateStart, carryStart, same(station), "Plating", {
          orderId: o.id,
          action: "plate",
        });
        add(
          carryStart,
          end,
          [station, { x: 260, y: station.y }, { x: 260, y: 225 }, pass],
          "Bringing order to the pass",
          { orderId: o.id, carry: o.channel === "dineIn" ? "plate" : "bag" },
        );
        position = pass;
        returnPath = [pass, { x: 260, y: 225 }, { x: 260, y: home.y }, home];
      } else {
        const fetch = begin + (end - begin) * 0.28;
        add(begin, fetch, [...lead, pass], "Collecting ready order", {
          orderId: o.id,
        });
        const target =
          o.tableId !== undefined
            ? {
                x: plan.tables[o.tableId].x + 49,
                y: plan.tables[o.tableId].y + 20,
              }
            : pickupPoint;
        const path =
          o.tableId !== undefined
            ? [
                pass,
                { x: 330, y: 225 },
                ...tableRoute({ x: 365, y: 225 }, o.tableId, target),
              ]
            : [
                pass,
                { x: 280, y: 225 },
                { x: 280, y: pickupPoint.y },
                pickupPoint,
              ];
        add(
          fetch,
          end,
          path,
          o.tableId !== undefined
            ? `Serving table ${o.tableId + 1}`
            : "Handing over pickup",
          { orderId: o.id, carry: o.tableId !== undefined ? "plate" : "bag" },
        );
        position = target;
        returnPath = [
          ...frontReturn(target, o.tableId),
          { x: 330, y: 225 },
          { x: 365, y: 225 },
          { x: 365, y: home.y },
          home,
        ];
      }
      cursor = end;
    }
    idleUntil(Math.max(cursor, shiftEnd - 0.8));
    add(
      Math.max(cursor, shiftEnd - 0.8),
      shiftEnd,
      kind === "server"
        ? [
            position,
            { x: 430, y: position.y },
            { x: 430, y: pickupPoint.y },
            { x: 280, y: pickupPoint.y },
            { x: 260, y: plan.height - 100 },
            { x: 170 + index * 7, y: plan.height - 20 },
          ]
        : [
            position,
            { x: 260, y: position.y },
            { x: 260, y: plan.height - 100 },
            { x: 170 + index * 7, y: plan.height - 20 },
          ],
      "Clocking out",
    );
    actor(
      `${kind}-${index}`,
      named(kind === "chef" ? "cook" : "front", index),
      kind,
      segments,
    );
  }
  for (let i = 0; i < config.cooks; i++) staffTrack("chef", i);
  for (let i = 0; i < config.servers; i++) staffTrack("server", i);
  for (const person of roster.filter((s) => s.group === "back")) {
    const start = person.start * 60,
      end = person.end * 60;
    if (start >= end) continue;
    const home = { x: 225, y: plan.height - 105 - person.index * 23 },
      segments: Segment[] = [];
    const jobs = orders
      .flatMap((o) => [
        ...(o.prepBackIndex === person.index &&
        Number.isFinite(o.prepSupportStart)
          ? [
              {
                start: o.prepSupportStart!,
                end: o.prepSupportEnd!,
                target: { x: 240, y: 120 },
                state: "Preparing ingredients",
                orderId: o.id,
              },
            ]
          : []),
        ...(o.washBackIndex === person.index && Number.isFinite(o.washStart)
          ? [
              {
                start: o.washStart!,
                end: o.washEnd!,
                target: { x: 145, y: plan.height - 105 },
                state: "Washing dishes",
                orderId: o.id,
              },
            ]
          : []),
      ])
      .sort((a, b) => a.start - b.start);
    let cursor = start,
      position = home;
    for (const job of jobs) {
      if (job.start > cursor)
        segments.push({
          start: cursor,
          end: job.start,
          path: same(position),
          state: `${roleLabels[person.role]} · available`,
          action: "clean",
        });
      const walkEnd = job.start + (job.end - job.start) * 0.3;
      segments.push({
        start: job.start,
        end: walkEnd,
        path: [
          position,
          { x: 260, y: position.y },
          { x: 260, y: job.target.y },
          job.target,
        ],
        state: `Walking to ${person.role === "prep" ? "prep" : "wash station"}`,
        orderId: job.orderId,
      });
      segments.push({
        start: walkEnd,
        end: job.end,
        path: same(job.target),
        state: job.state,
        orderId: job.orderId,
        action: person.role === "prep" ? "chop" : "clean",
      });
      position = job.target;
      cursor = job.end;
      addEvent(
        job.start,
        `${person.name}: ${job.state.toLowerCase()}`,
        "backroom",
        `${job.orderId}-${person.role}`,
      );
    }
    if (cursor < end)
      segments.push({
        start: cursor,
        end,
        path: same(position),
        state: `${roleLabels[person.role]} · available`,
        action: "clean",
      });
    actor(`backroom-${person.index}`, person.name, "backroom", segments, {
      color: "#7b829d",
    });
  }
  const dine = orders.filter((o) => o.channel === "dineIn");
  const pickups = orders.filter(
    (o) =>
      ["pickup", "doordash"].includes(o.channel) && Number.isFinite(o.start),
  );
  const collectionArrival = (o: Order) =>
    Math.max(
      o.start + 0.5,
      o.ready -
        (o.channel === "doordash" ? 2.5 : 1.5) -
        (hash(o.id) % 100) / 100,
    );
  const slots = (
    items: Order[],
    arrival: (o: Order) => number,
    release: (o: Order) => number,
  ) => {
    const ends: number[] = [],
      map = new Map<string, number>();
    for (const order of [...items].sort((a, b) => arrival(a) - arrival(b))) {
      const at = arrival(order);
      let index = ends.findIndex((t) => t <= at);
      if (index < 0) index = ends.length;
      ends[index] = release(order);
      map.set(order.id, index);
    }
    return map;
  };
  const dineSlots = slots(
      dine,
      (o) => o.arrival,
      (o) => Math.min(o.start, o.finish),
    ),
    pickupSlots = slots(
      pickups,
      collectionArrival,
      (o) => o.serviceStart ?? o.finish,
    );
  for (const o of orders) {
    const short = o.id.replace("MSK-", "#");
    if (Number.isFinite(o.start)) {
      addEvent(
        o.start,
        `${named("cook", o.cookId ?? 0)} started ${short}`,
        "chef",
        `${o.id}-start`,
      );
      addEvent(
        o.ready,
        `${short} is ready at the pass`,
        "order",
        `${o.id}-ready`,
      );
    }
    if (o.channel === "dineIn") {
      const party = o.partySize ?? 2,
        rank = dineSlots.get(o.id) ?? 0;
      const end = Number.isFinite(o.start)
        ? o.status === "lost"
          ? o.finish
          : Math.min(duration + 28, o.finish + 28)
        : Math.min(duration, o.finish);
      addEvent(
        o.arrival,
        `Party of ${party} arrived`,
        "guest",
        `${o.id}-arrive`,
      );
      for (let member = 0; member < party; member++) {
        const q = queuePoint("guest", rank, member),
          offset = {
            x: q.x + ((member % 3) - Math.min(party - 1, 2) / 2) * 18,
            y: q.y + Math.floor(member / 3) * 18,
          };
        const entry = {
          x: outside.x + (member % 2) * 9,
          y: outside.y + member * 4,
        };
        const segments: Segment[] = [
          {
            start: o.arrival - 1.25 - member * 0.04,
            end: o.arrival,
            path:
              offset.y > plan.height - 37
                ? [entry, { x: offset.x, y: entry.y }, offset]
                : [
                    entry,
                    { x: entrance.x, y: entrance.y },
                    { x: entrance.x, y: foyer },
                    offset,
                  ],
            state: "Arriving",
          },
        ];
        if (Number.isFinite(o.start) && o.tableId !== undefined) {
          const table = plan.tables[o.tableId],
            seatIndex = Math.floor((member * table.seats) / party),
            seat = seatPoint(table, seatIndex),
            seatTime = o.start + 1.6 + member * 0.035;
          if (o.start > o.arrival)
            segments.push({
              start: o.arrival,
              end: o.start,
              path: same(offset),
              state: "Waiting to be seated",
            });
          segments.push({
            start: o.start,
            end: seatTime,
            path: tableRoute(offset, o.tableId, seat),
            state: `Walking to table ${o.tableId + 1}`,
          });
          if (o.finish > seatTime)
            segments.push({
              start: seatTime,
              end: Math.min(o.finish, end),
              path: same(seat),
              state: "Waiting for food",
            });
          if (end > o.finish)
            segments.push({
              start: o.finish,
              end,
              path: same(seat),
              state: "Enjoying a meal",
              action: "eat",
            });
          const exit = tableReturn(seat, o.tableId).slice(0, 4);
          exit.push(
            { x: 365, y: foyer },
            { x: entrance.x, y: foyer },
            entrance,
            entry,
          );
          segments.push({
            start: end,
            end: end + 2.1,
            path: exit,
            state: "Leaving",
          });
          actor(
            `${o.id}-guest-${member}`,
            `Guest ${member + 1} · party of ${party}`,
            "guest",
            segments,
            { tableId: o.tableId, seatIndex },
          );
        } else {
          if (end > o.arrival)
            segments.push({
              start: o.arrival,
              end,
              path: same(offset),
              state: "Waiting to be seated",
            });
          segments.push({
            start: end,
            end: end + 1.3,
            path: [offset, { x: entrance.x, y: foyer }, entrance, entry],
            state: o.stockout
              ? "Leaving · sold out"
              : "Leaving · wait too long",
          });
          actor(
            `${o.id}-guest-${member}`,
            `Guest ${member + 1} · party of ${party}`,
            "guest",
            segments,
          );
        }
      }
      if (o.tableId !== undefined) {
        addEvent(
          o.start + 1.7,
          `Party of ${party} seated at table ${o.tableId + 1}`,
          "guest",
          `${o.id}-seated`,
        );
        addEvent(
          end,
          `Party left table ${o.tableId + 1}`,
          "server",
          `${o.id}-left`,
        );
      }
    } else if (o.channel === "doordash" || o.channel === "pickup") {
      if (!Number.isFinite(o.start)) continue;
      const arrival = collectionArrival(o),
        kind = o.channel === "doordash" ? "dasher" : "pickup",
        rank = pickupSlots.get(o.id) ?? 0,
        q = queuePoint(kind, rank),
        entry = { x: outside.x + 23, y: outside.y };
      const handoff = Number.isFinite(o.serviceStart)
          ? o.serviceStart!
          : duration + 2,
        end = Number.isFinite(o.finish) ? o.finish : duration + 4;
      const segments: Segment[] = [
        {
          start: arrival - 1.4,
          end: arrival,
          path:
            q.y > plan.height - 37
              ? [entry, { x: q.x, y: entry.y }, q]
              : [
                  entry,
                  { x: entrance.x, y: entrance.y },
                  { x: entrance.x, y: foyer },
                  q,
                ],
          state: "Arriving for pickup",
        },
      ];
      if (handoff > arrival)
        segments.push({
          start: arrival,
          end: handoff,
          path: same(q),
          state: "Waiting for order",
        });
      segments.push({
        start: handoff,
        end,
        path: [
          q,
          ...(q.y > plan.height - 37
            ? [entrance, { x: entrance.x, y: foyer }]
            : []),
          {
            x: q.y > plan.height - 37 ? entrance.x : q.x,
            y: pickupPoint.y + 36,
          },
          { x: pickupPoint.x + 20, y: pickupPoint.y + 36 },
          { x: pickupPoint.x + 20, y: pickupPoint.y },
        ],
        state: "Collecting order",
        orderId: o.id,
      });
      segments.push({
        start: end,
        end: end + 1.7,
        path: [
          { x: pickupPoint.x + 20, y: pickupPoint.y },
          { x: pickupPoint.x + 20, y: foyer },
          { x: entrance.x, y: foyer },
          entrance,
          entry,
        ],
        state: "Leaving with order",
        orderId: o.id,
        carry: "bag",
      });
      actor(
        `${o.id}-pickup`,
        `${kind === "dasher" ? "Dasher" : "Pickup customer"} · ${short}`,
        kind,
        segments,
      );
      addEvent(
        arrival,
        `${kind === "dasher" ? "Dasher" : "Customer"} arrived for ${short}`,
        kind,
        `${o.id}-pickup-arrive`,
      );
      addEvent(end, `${short} collected`, kind, `${o.id}-collected`);
    } else {
      const end = Number.isFinite(o.finish) ? o.finish : duration + 3,
        rank = orders.filter(
          (x) =>
            x.channel === "driveThrough" &&
            x.arrival < o.arrival &&
            x.finish > o.arrival,
        ).length;
      const laneY = 17,
        start = { x: plan.width + 70, y: laneY },
        wait = { x: plan.width - 130 - rank * 59, y: laneY },
        window = { x: 365, y: laneY };
      const service = Number.isFinite(o.serviceStart)
        ? o.serviceStart!
        : end - 1;
      actor(`${o.id}-car`, `${short} · drive-through`, "car", [
        {
          start: o.arrival - 1,
          end: o.arrival,
          path: [start, wait],
          state: "Joining drive-through",
        },
        {
          start: o.arrival,
          end: Math.max(o.arrival, service),
          path: same(wait),
          state: "Waiting in drive-through",
        },
        { start: service, end, path: [wait, window], state: "At the window" },
        {
          start: end,
          end: end + 1.2,
          path: [window, { x: -70, y: laneY }],
          state: "Departing",
        },
      ]);
    }
  }
  return {
    config,
    plan,
    tracks,
    events: events.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id)),
    orders,
    duration,
    entrance,
    pass,
    pickupPoint,
  };
}
export function replayAt(replay: Replay, time: number) {
  const actors: ReplayActor[] = [];
  for (const track of replay.tracks) {
    const segment = track.segments.find((s) => s.start <= time && time < s.end);
    if (!segment) continue;
    const progress = (time - segment.start) / (segment.end - segment.start),
      sample = pathPosition(segment.path, progress);
    const walking = segment.path.some(
      (p) => distance(p, segment.path[0]) > 0.5,
    );
    const first = track.segments[0].start,
      last = track.segments.at(-1)!.end;
    let angle = sample.angle;
    if (!walking) {
      if (
        track.kind === "guest" &&
        track.tableId !== undefined &&
        ["Waiting for food", "Enjoying a meal"].includes(segment.state)
      ) {
        const table = replay.plan.tables[track.tableId];
        angle =
          (Math.atan2(
            table.y - sample.position.y,
            table.x - sample.position.x,
          ) *
            180) /
          Math.PI;
      } else if (segment.action) angle = -90;
      else if (["dasher", "pickup"].includes(track.kind))
        angle =
          (Math.atan2(
            replay.pickupPoint.y - sample.position.y,
            replay.pickupPoint.x - sample.position.x,
          ) *
            180) /
          Math.PI;
      else if (track.kind === "guest") angle = 180;
    }
    actors.push({
      ...track,
      segment,
      progress,
      position: sample.position,
      angle,
      walking,
      opacity: Math.min(
        1,
        Math.max(0, (time - first) / 0.15),
        Math.max(0, (last - time) / 0.15),
      ),
    });
  }
  const meals = replay.orders
    .filter(
      (o) =>
        o.tableId !== undefined &&
        o.status === "completed" &&
        o.finish <= time &&
        time < (o.tableReadyAt ?? o.finish + 28),
    )
    .map((o) => ({
      tableId: o.tableId!,
      partySize: o.partySize ?? 2,
      orderId: o.id,
    }));
  const cooking = replay.orders.filter(
    (o) => o.start <= time && o.ready > time,
  );
  return {
    actors,
    meals,
    cooking,
    events: replay.events
      .filter((e) => e.time <= time)
      .slice(-4)
      .reverse(),
    time,
  };
}
