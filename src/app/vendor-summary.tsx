import type { Result, Config } from "@/lib/simulation";
import { basisLabels } from "@/lib/costs";
const usd = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    v,
  );
export default function VendorSummary({
  result,
  config,
}: {
  result: Result;
  config: Config;
}) {
  return (
    <section className="panel data-orders">
      <div className="panel-heading">
        <div>
          <h2>Your suppliers & operating costs</h2>
          <p>Unit prices and actual costs for this day.</p>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Supplier / item</th>
              <th>Usage</th>
              <th>Unit price</th>
              <th>Day cost</th>
            </tr>
          </thead>
          <tbody>
            {result.vendorBreakdown.map((v) => (
              <tr key={v.line.id}>
                <td>
                  <strong>{v.line.supplier}</strong>
                  <small>{v.line.item}</small>
                </td>
                <td>
                  {v.line.quantity} {basisLabels[v.line.basis]}
                </td>
                <td>{usd(v.line.unitPrice)}</td>
                <td>{usd(v.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {config.fixedCosts?.length ? (
        <div className="fixed-cost-summary">
          {config.fixedCosts.map((v) => (
            <div key={v.id}>
              <span>{v.name}</span>
              <strong>{usd(v.amount)} / day</strong>
            </div>
          ))}
        </div>
      ) : null}
      <div className="model-note">
        <p>
          Ingredients are included in food cost; daily services are in overhead.
          Takeaway packaging and other variable services are shown separately.
        </p>
      </div>
    </section>
  );
}
