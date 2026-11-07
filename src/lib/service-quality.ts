import type { Config, Order } from "./simulation";
import { staffingSlots, defaultStaffPlan, withStaffPlan } from "./staffing";
export function toggleDrive(c: Config, enabled: boolean) {
  let next = { ...c, driveThrough: enabled };
  if (enabled) {
    next = withStaffPlan(next, defaultStaffPlan(next));
    if (!driveCoverage(next))
      next = withStaffPlan(next, [
        ...next.staffPlan!,
        {
          id: "drive-coverage-" + next.staffPlan!.length,
          role: "driveThrough",
          count: 1,
          start: 0,
          end: c.hours,
        },
      ]);
  }
  return next;
}
export function driveCoverage(c: Config) {
  if (!c.staffPlan || !c.driveThrough) return true;
  const shifts = staffingSlots(c)
    .filter((s) => s.role === "driveThrough" || s.group === "back")
    .sort((a, b) => a.start - b.start);
  let until = 0;
  for (const s of shifts) {
    if (s.start > until + 1e-8) break;
    until = Math.max(until, s.end);
  }
  return until >= c.hours;
}
export function serviceQuality(c: Config, o: Order) {
  if (!c.staffPlan || o.status !== "completed") return 0;
  const active = staffingSlots(c).filter(
    (s) => s.start * 60 <= o.arrival && s.end * 60 > o.arrival,
  );
  const washing = active.some((s) => s.role === "dishwasher") ? 0.15 : -0.12;
  const bussing =
    o.channel === "dineIn"
      ? active.some((s) => s.role === "busser")
        ? 0.2
        : active.some((s) => s.role === "front" || s.role === "waiter")
          ? 0
          : -0.2
      : 0;
  return washing + bussing;
}
