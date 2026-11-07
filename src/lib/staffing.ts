import type { Config } from "./simulation";
export const roleLabels = {
  cook: "Cooking",
  front: "General front service",
  waiter: "Waiting tables",
  busser: "Bussing tables",
  cashier: "Cashier / pickup handoff",
  driveThrough: "Drive-through",
  dishwasher: "Dishwashing",
  prep: "Food preparation",
};
export type StaffRole = keyof typeof roleLabels;
export type StaffGroup = "cook" | "front" | "back";
export type StaffAssignment = {
  id: string;
  role: StaffRole;
  count: number;
  start: number;
  end: number;
};
export type StaffSlot = {
  id: string;
  role: StaffRole;
  group: StaffGroup;
  index: number;
  name: string;
  start: number;
  end: number;
  pay: number;
};
export const roleGroup = (role: StaffRole): StaffGroup =>
  role === "cook"
    ? "cook"
    : ["prep", "dishwasher"].includes(role)
      ? "back"
      : "front";
export function defaultStaffPlan(c: Config): StaffAssignment[] {
  if (c.staffPlan) return c.staffPlan.map((s) => ({ ...s }));
  const plan: StaffAssignment[] = [];
  for (const group of ["cook", "front", "back"] as const) {
    const people = c.staff?.filter((p) => p.role === group) ?? [],
      count =
        group === "cook"
          ? c.cooks
          : group === "front"
            ? c.servers
            : people.length;
    for (let i = 0; i < count; i++) {
      const p = people[i];
      plan.push({
        id: `${group}-${i}`,
        role: group === "back" ? "dishwasher" : group,
        count: 1,
        start: p?.start ?? 0,
        end: Math.min(c.hours, p?.end ?? c.hours),
      });
    }
  }
  return plan;
}
export function staffingSlots(c: Config): StaffSlot[] {
  const indexes = { cook: 0, front: 0, back: 0 },
    slots: StaffSlot[] = [];
  for (const shift of defaultStaffPlan(c)) {
    const group = roleGroup(shift.role);
    for (let i = 0; i < Math.max(0, Math.min(24, shift.count)); i++) {
      const index = indexes[group]++,
        person = c.staff?.filter((p) => p.role === group)[index];
      slots.push({
        id: `${shift.id}-${i}`,
        role: shift.role,
        group,
        index,
        name: person?.name ?? `${roleLabels[shift.role]} ${index + 1}`,
        start: Math.max(0, shift.start),
        end: Math.min(c.hours, shift.end),
        pay: person?.pay ?? c.wage,
      });
    }
  }
  return slots;
}
export function validateStaffPlan(plan: StaffAssignment[]) {
  if (!Array.isArray(plan) || plan.length > 40)
    throw new Error("Use up to 40 staff shift rows.");
  let total = 0;
  const ids = new Set<string>();
  for (const s of plan) {
    if (
      !s ||
      typeof s.id !== "string" ||
      !s.id.trim() ||
      ids.has(s.id) ||
      !Object.hasOwn(roleLabels, s.role) ||
      !Number.isInteger(s.count) ||
      s.count < 0 ||
      s.count > 24 ||
      !Number.isFinite(s.start) ||
      !Number.isFinite(s.end) ||
      s.start < 0 ||
      s.end <= s.start ||
      s.end > 24
    )
      throw new Error(
        "Each staff type needs 0–24 people and valid shift hours.",
      );
    total += s.count;
    ids.add(s.id);
  }
  if (total > 96) throw new Error("Use up to 96 staff across all shift types.");
}
export function withStaffPlan(c: Config, staffPlan: StaffAssignment[]): Config {
  return {
    ...c,
    staffPlan,
    cooks: staffPlan
      .filter((s) => s.role === "cook")
      .reduce((n, s) => n + s.count, 0),
    servers: staffPlan
      .filter((s) => roleGroup(s.role) === "front")
      .reduce((n, s) => n + s.count, 0),
  };
}
export function resizeStaffGroup(
  c: Config,
  group: StaffGroup,
  total: number,
): Config {
  const plan = defaultStaffPlan(c),
    rows = plan.filter((s) => roleGroup(s.role) === group),
    current = rows.reduce((n, s) => n + s.count, 0);
  if (!rows.length) {
    plan.push({
      id: `${group}-new`,
      role: group === "back" ? "dishwasher" : group,
      count: total,
      start: 0,
      end: c.hours,
    });
    return withStaffPlan(c, plan);
  }
  let left = total;
  const counts = rows.map((s) =>
    Math.floor(total * (current ? s.count / current : 1 / rows.length)),
  );
  for (let i = 0; i < counts.length; i++) left -= counts[i];
  for (let i = 0; left > 0; i = (i + 1) % counts.length) {
    counts[i]++;
    left--;
  }
  for (let i = 0; i < rows.length; i++) rows[i].count = counts[i];
  return withStaffPlan(c, plan);
}
export function setStoreHours(
  c: Config,
  opening: number,
  hours: number,
): Config {
  const delta = opening - (c.openingHour ?? 11),
    plan = defaultStaffPlan(c).map((s) => {
      const start = Math.min(Math.max(0, s.start - delta), hours - 0.25),
        end = Math.max(start + 0.25, Math.min(hours, s.end - delta));
      return {
        ...s,
        start,
        end,
        count: s.end - delta <= 0 || s.start - delta >= hours ? 0 : s.count,
      };
    });
  return withStaffPlan(
    {
      ...c,
      openingHour: opening,
      hours,
      diningStart: Math.max(
        0,
        Math.min(
          hours,
          c.diningStart === undefined ? 0 : c.diningStart - delta,
        ),
      ),
      diningEnd: Math.max(
        0,
        Math.min(
          hours,
          c.diningEnd === undefined ? hours : c.diningEnd - delta,
        ),
      ),
    },
    plan,
  );
}
