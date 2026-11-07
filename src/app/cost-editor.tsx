"use client";
import { Plus, X } from "lucide-react";
import { basisLabels, FixedCost, VendorLine } from "@/lib/costs";
export default function CostEditor({
  vendors,
  fixed,
  onVendors,
  onFixed,
}: {
  vendors: VendorLine[];
  fixed: FixedCost[];
  onVendors: (lines: VendorLine[]) => void;
  onFixed: (lines: FixedCost[]) => void;
}) {
  const change = (index: number, patch: Partial<VendorLine>) =>
    onVendors(vendors.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  return (
    <div className="cost-editor">
      <p className="field-hint">
        Track each supplier’s item, quantity and unit price. Quantities use the
        charging unit you select.
      </p>
      {vendors.map((v, i) => (
        <article className="vendor-editor" key={v.id}>
          <div className="vendor-editor-top">
            <strong>Supplier {i + 1}</strong>
            <button
              className="icon-button"
              aria-label={`Remove supplier ${i + 1}`}
              onClick={() => onVendors(vendors.filter((_, j) => j !== i))}
            >
              <X size={14} />
            </button>
          </div>
          <div className="review-pair">
            <label className="setup-field">
              <span>Supplier name</span>
              <input
                aria-label={`Supplier ${i + 1} name`}
                value={v.supplier}
                placeholder="e.g. US Foods"
                onChange={(e) => change(i, { supplier: e.target.value })}
              />
            </label>
            <label className="setup-field">
              <span>Item / service</span>
              <input
                aria-label={`Supplier ${i + 1} item`}
                value={v.item}
                placeholder="e.g. Paper bags"
                onChange={(e) => change(i, { item: e.target.value })}
              />
            </label>
          </div>
          <div className="review-pair">
            <label className="setup-field">
              <span>Category</span>
              <select
                aria-label={`Supplier ${i + 1} category`}
                value={v.category}
                onChange={(e) =>
                  change(i, {
                    category: e.target.value as VendorLine["category"],
                    ...(e.target.value === "ingredients"
                      ? { basis: "preparedOrder" as const }
                      : {}),
                  })
                }
              >
                <option value="packaging">Packaging</option>
                <option value="ingredients">Ingredients</option>
                <option value="services">Services / other</option>
              </select>
            </label>
            <label className="setup-field">
              <span>Charging unit</span>
              <select
                aria-label={`Supplier ${i + 1} charging unit`}
                value={v.basis}
                onChange={(e) =>
                  change(i, { basis: e.target.value as VendorLine["basis"] })
                }
              >
                {Object.entries(basisLabels)
                  .filter(
                    ([basis]) =>
                      v.category !== "ingredients" || basis === "preparedOrder",
                  )
                  .map(([key, name]) => (
                    <option key={key} value={key}>
                      {name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <div className="vendor-prices">
            <label className="setup-field">
              <span>Units used {basisLabels[v.basis]}</span>
              <input
                aria-label={`Supplier ${i + 1} quantity`}
                type="number"
                min=".01"
                step=".01"
                value={v.quantity}
                onChange={(e) => change(i, { quantity: +e.target.value })}
              />
            </label>
            <label className="setup-field">
              <span>Price $ / unit</span>
              <input
                aria-label={`Supplier ${i + 1} unit price`}
                type="number"
                min="0"
                step=".01"
                value={v.unitPrice}
                onChange={(e) => change(i, { unitPrice: +e.target.value })}
              />
            </label>
          </div>
          {v.category === "ingredients" && (
            <p className="vendor-footnote">
              These ingredient rates replace the food-cost percentage for
              prepared orders, avoiding double counting.
            </p>
          )}
        </article>
      ))}
      <button
        className="button secondary"
        disabled={vendors.length >= 40}
        onClick={() =>
          onVendors([
            ...vendors,
            {
              id: crypto.randomUUID(),
              supplier: "",
              item: "",
              category: "packaging",
              basis: "takeawayOrder",
              quantity: 1,
              unitPrice: 0,
            },
          ])
        }
      >
        <Plus size={14} />
        Add supplier / item
      </button>
      <h3 className="fixed-cost-title">Other daily operating costs</h3>
      <p className="field-hint">
        Split rent, utilities, software, insurance or other expenses into
        separate lines.
      </p>
      {fixed.map((cost, i) => (
        <div className="fixed-cost-editor" key={cost.id}>
          <label className="setup-field">
            <span>Cost name</span>
            <input
              aria-label={`Fixed cost ${i + 1} name`}
              placeholder="e.g. Utilities"
              value={cost.name}
              onChange={(e) =>
                onFixed(
                  fixed.map((v, j) =>
                    j === i ? { ...v, name: e.target.value } : v,
                  ),
                )
              }
            />
          </label>
          <label className="setup-field">
            <span>$ / day</span>
            <input
              aria-label={`Fixed cost ${i + 1} amount`}
              type="number"
              min="0"
              step=".01"
              value={cost.amount}
              onChange={(e) =>
                onFixed(
                  fixed.map((v, j) =>
                    j === i ? { ...v, amount: +e.target.value } : v,
                  ),
                )
              }
            />
          </label>
          <button
            className="icon-button"
            aria-label={`Remove fixed cost ${i + 1}`}
            onClick={() => onFixed(fixed.filter((_, j) => i !== j))}
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        className="button secondary"
        disabled={fixed.length >= 40}
        onClick={() =>
          onFixed([...fixed, { id: crypto.randomUUID(), name: "", amount: 0 }])
        }
      >
        <Plus size={14} />
        Add fixed cost
      </button>
      {!fixed.length && (
        <button
          className="text-button"
          onClick={() =>
            onFixed([
              {
                id: crypto.randomUUID(),
                name: "No additional daily costs",
                amount: 0,
              },
            ])
          }
        >
          No other daily costs
        </button>
      )}
      <div className="fixed-total">
        Other daily costs total
        <strong>
          ${fixed.reduce((sum, v) => sum + v.amount, 0).toFixed(2)}
        </strong>
      </div>
    </div>
  );
}
