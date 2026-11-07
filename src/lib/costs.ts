export type VendorLine = {
  id: string;
  supplier: string;
  item: string;
  category: "ingredients" | "packaging" | "services";
  basis: "preparedOrder" | "takeawayOrder" | "day";
  quantity: number;
  unitPrice: number;
};
export type FixedCost = { id: string; name: string; amount: number };
export const basisLabels = {
  preparedOrder: "per prepared order",
  takeawayOrder: "per takeaway order",
  day: "per day",
};
export function validateVendors(lines: VendorLine[]) {
  if (!Array.isArray(lines) || lines.length > 40)
    throw new Error("Use at most 40 vendor items.");
  for (const v of lines)
    if (
      !v ||
      typeof v.id !== "string" ||
      typeof v.supplier !== "string" ||
      !v.supplier.trim() ||
      typeof v.item !== "string" ||
      !v.item.trim() ||
      !["ingredients", "packaging", "services"].includes(v.category) ||
      !["preparedOrder", "takeawayOrder", "day"].includes(v.basis) ||
      !Number.isFinite(v.quantity) ||
      v.quantity <= 0 ||
      v.quantity > 10000 ||
      !Number.isFinite(v.unitPrice) ||
      v.unitPrice < 0 ||
      v.unitPrice > 5000 ||
      (v.category === "ingredients" && v.basis !== "preparedOrder")
    )
      throw new Error(
        "Each vendor item needs a supplier, item, valid quantity and prices. Ingredient costs must be per prepared order.",
      );
}
export function validateFixedCosts(lines: FixedCost[]) {
  if (
    !Array.isArray(lines) ||
    lines.length > 40 ||
    lines.some(
      (v) =>
        !v ||
        typeof v.id !== "string" ||
        typeof v.name !== "string" ||
        !v.name.trim() ||
        !Number.isFinite(v.amount) ||
        v.amount < 0 ||
        v.amount > 5000,
    )
  )
    throw new Error(
      "Each fixed cost needs a name and a daily amount of $0–$5,000.",
    );
}
export function vendorExpenses(
  lines: VendorLine[],
  prepared: number,
  takeaway: number,
  portions: number = prepared,
) {
  return lines.map((line) => {
    const uses =
      line.basis === "day"
        ? 1
        : line.basis === "preparedOrder"
          ? line.category === "ingredients"
            ? portions
            : prepared
          : takeaway;
    return { line, amount: line.quantity * line.unitPrice * uses };
  });
}
export const demoVendors: VendorLine[] = [
  {
    id: "bags",
    supplier: "Maple Paper Co.",
    item: "Paper takeaway bag",
    category: "packaging",
    basis: "takeawayOrder",
    quantity: 1,
    unitPrice: 0.24,
  },
  {
    id: "food",
    supplier: "US Foods",
    item: "Burger ingredients / portion",
    category: "ingredients",
    basis: "preparedOrder",
    quantity: 1,
    unitPrice: 6.2,
  },
  {
    id: "service",
    supplier: "Clean Kitchen Services",
    item: "Equipment & linen service",
    category: "services",
    basis: "day",
    quantity: 1,
    unitPrice: 35,
  },
];
export const demoFixedCosts: FixedCost[] = [
  { id: "rent", name: "Rent allocation", amount: 45 },
  { id: "utilities", name: "Utilities", amount: 22 },
  { id: "software", name: "Software & insurance", amount: 8 },
];
