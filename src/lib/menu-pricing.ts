import type { Config, MenuItem } from "./simulation";
export type Deal =
  | { id: string; type: "bogo"; item: string; enabled: boolean }
  | {
      id: string;
      type: "threshold";
      minimum: number;
      percent: number;
      enabled: boolean;
    };
export function validateDeals(c: Config) {
  if (c.itemPrices) {
    for (const [name, price] of Object.entries(c.itemPrices))
      if (
        !c.menu?.some((m) => m.name === name) ||
        !Number.isFinite(price) ||
        price < 1 ||
        price > 200
      )
        throw new Error("Item prices must match a menu item and be $1–$200.");
  }
  if (c.deals && (!Array.isArray(c.deals) || c.deals.length > 12))
    throw new Error("Use up to 12 deals.");
  for (const d of c.deals ?? []) {
    if (
      !d ||
      typeof d.enabled !== "boolean" ||
      (d.type === "bogo"
        ? !c.menu?.some((m) => m.name === d.item)
        : d.type === "threshold"
          ? !Number.isFinite(d.minimum) ||
            d.minimum < 1 ||
            d.minimum > 500 ||
            !Number.isFinite(d.percent) ||
            d.percent < 1 ||
            d.percent > 70
          : true)
    )
      throw new Error(
        "BOGO needs a menu item; order discounts need a $1–$500 minimum and 1–70% off.",
      );
  }
}
export function quoteBasket(c: Config, item: MenuItem, draw: number) {
  const bogo = (c.deals ?? []).some(
    (d) => d.enabled && d.type === "bogo" && d.item === item.name,
  );
  const quantity = bogo
    ? 2
    : c.staffPlan
      ? draw < 0.6
        ? 1
        : draw < 0.9
          ? 2
          : 3
      : 1;
  const unit =
      (c.itemPrices?.[item.name] ?? item.price) * (1 + c.priceChange / 100),
    gross = unit * quantity;
  let saving = 0,
    dealName: string | undefined;
  for (const deal of c.deals ?? []) {
    if (!deal.enabled) continue;
    const discount =
      deal.type === "bogo" && deal.item === item.name
        ? Math.floor(quantity / 2) * unit
        : deal.type === "threshold" && gross >= deal.minimum
          ? (gross * deal.percent) / 100
          : 0;
    if (discount > saving) {
      saving = discount;
      dealName =
        deal.type === "bogo"
          ? `BOGO ${item.name}`
          : `${deal.percent}% off $${deal.minimum}+`;
    }
  }
  const subtotal = gross - saving,
    reference = item.price * quantity;
  return {
    quantity,
    subtotal,
    reference,
    priceChange: (subtotal / reference - 1) * 100,
    dealName,
  };
}
export function menuPriceEffect(c: Config) {
  if (!c.menu?.length || (!c.itemPrices && !c.deals?.some((d) => d.enabled)))
    return c.priceChange;
  return c.menu.reduce(
    (sum, item) =>
      sum +
      item.popularity *
        [0.2, 0.7, 0.95].reduce(
          (score, draw, i) =>
            score + quoteBasket(c, item, draw).priceChange * [0.6, 0.3, 0.1][i],
          0,
        ),
    0,
  );
}
