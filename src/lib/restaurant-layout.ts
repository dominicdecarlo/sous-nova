import type { Config } from "./simulation";
export const MAX_TABLES = 500,
  MAX_SEATS = 2000;
export function diningTableCount(
  c: Pick<Config, "preset" | "seats" | "tables">,
) {
  return Math.ceil(c.seats / 4);
}
export function validatePhysicalLayout(
  preset: string,
  seats: number,
  tables: number,
  stations: number,
) {
  if (!Number.isInteger(stations) || stations < 1 || stations > 12)
    throw new Error("Enter 1–12 kitchen stations.");
  if (!Number.isInteger(seats) || seats < 0 || seats > MAX_SEATS)
    throw new Error(`Enter a whole-number seat count up to ${MAX_SEATS}.`);
}
export function restaurantLayout(
  c: Pick<Config, "preset" | "seats" | "tables" | "stations">,
) {
  const count = diningTableCount(c),
    columns = count ? Math.min(20, Math.ceil(Math.sqrt(count * 1.4))) : 0,
    rows = columns ? Math.ceil(count / columns) : 0;
  const width = Math.max(840, 390 + columns * 108 + 45),
    height = Math.max(
      540,
      rows * 104 + 250,
      Math.ceil(c.stations / 2) * 90 + 200,
    );
  return {
    width,
    height,
    columns,
    rows,
    tables: Array.from({ length: count }, (_, i) => ({
      id: i,
      x: 410 + (i % columns) * 108,
      y: 118 + Math.floor(i / columns) * 104,
      seats: Math.min(4,c.seats-i*4),
    })),
  };
}
