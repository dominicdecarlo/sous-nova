"use client";
import { useState } from "react";
import {
  Plus,
  Trash2,
  Users,
  Clock3,
  UtensilsCrossed,
  SlidersHorizontal,
} from "lucide-react";
import { Config, forecastDemand } from "@/lib/simulation";
import { clock } from "@/lib/onboarding";
import {
  defaultStaffPlan,
  roleGroup,
  roleLabels,
  StaffGroup,
  StaffRole,
  withStaffPlan,
  resizeStaffGroup,
  setStoreHours,
} from "@/lib/staffing";
import type { Deal } from "@/lib/menu-pricing";
const groups: [StaffGroup, string][] = [
  ["cook", "Cooking"],
  ["front", "Front room"],
  ["back", "Backroom"],
];
const tabs = [
  ["staff", "Staff", Users],
  ["hours", "Hours", Clock3],
  ["menu", "Menu", UtensilsCrossed],
  ["other", "Other", SlidersHorizontal],
] as const;
function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 24,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="scenario-input">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(+e.target.value)}
      />
    </label>
  );
}
function Range({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <label className="slider-label">
      <span>
        {label}
        <b>
          {value > 0 ? "+" : ""}
          {value}%
        </b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
      />
      <span className="range-ends">
        <small>{min}%</small>
        <small>+{max}%</small>
      </span>
    </label>
  );
}
function TimeSelect({
  label,
  value,
  hours,
  opening,
  onChange,
}: {
  label: string;
  value: number;
  hours: number;
  opening: number;
  onChange: (n: number) => void;
}) {
  const times = [
    ...new Set([
      ...Array.from({ length: Math.floor(hours * 4) + 1 }, (_, i) => i / 4),
      hours,
      value,
    ]),
  ]
    .filter((n) => n >= 0 && n <= hours)
    .sort((a, b) => a - b);
  return (
    <label className="scenario-input">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(+e.target.value)}>
        {times.map((n) => (
          <option key={n} value={n}>
            {clock(opening + n)}
          </option>
        ))}
      </select>
    </label>
  );
}
export default function ScenarioTabs({
  config: c,
  onPatch,
}: {
  config: Config;
  onPatch: (p: Partial<Config>) => void;
}) {
  const [tab, setTab] = useState("staff"),
    plan = defaultStaffPlan(c),
    opening = c.openingHour ?? 11,
    forecast = forecastDemand(c);
  const patchPlan = (next: typeof plan) => onPatch(withStaffPlan(c, next));
  const dealPatch = (id: string, patch: Partial<Deal>) =>
    onPatch({
      deals: c.deals?.map((d) =>
        d.id === id ? ({ ...d, ...patch } as Deal) : d,
      ),
    });
  const addDeal = (type: "bogo" | "threshold") =>
    onPatch({
      deals: [
        ...(c.deals ?? []),
        type === "bogo"
          ? {
              id: crypto.randomUUID(),
              type,
              item: c.menu?.[0]?.name ?? "",
              enabled: true,
            }
          : {
              id: crypto.randomUUID(),
              type,
              minimum: 30,
              percent: 10,
              enabled: true,
            },
      ],
    });
  return (
    <>
      <div
        className="scenario-tabs"
        role="tablist"
        aria-label="Scenario settings"
      >
        {tabs.map(([id, label, Icon]) => (
          <button
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-controls={`settings-${id}`}
            aria-selected={tab === id}
            tabIndex={tab === id ? 0 : -1}
            key={id}
            onClick={() => setTab(id)}
            onKeyDown={(e) => {
              if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
                e.preventDefault();
                const current = tabs.findIndex((t) => t[0] === id),
                  next =
                    e.key === "Home"
                      ? 0
                      : e.key === "End"
                        ? 3
                        : (current + (e.key === "ArrowRight" ? 1 : 3)) % 4;
                setTab(tabs[next][0]);
                document.getElementById(`tab-${tabs[next][0]}`)?.focus();
              }
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>
      <div
        className="scenario-tab-panel"
        key={tab}
        role="tabpanel"
        id={`settings-${tab}`}
        aria-labelledby={`tab-${tab}`}
        tabIndex={0}
      >
        {tab === "staff" && (
          <>
            <div className="tab-intro">
              <h3>A team for every part of the day</h3>
              <p>
                Set headcounts, then assign roles and shift hours. General front
                staff can wait, bus and hand off orders. Pay stays fixed.
              </p>
            </div>
            {groups.map(([group, label]) => {
              const rows = plan.filter((s) => roleGroup(s.role) === group),
                count = rows.reduce((sum, s) => sum + s.count, 0);
              return (
                <section className="staff-group" key={group}>
                  <NumberField
                    label={`${label} · people`}
                    value={count}
                    max={24}
                    onChange={(n) =>
                      onPatch(
                        resizeStaffGroup(
                          c,
                          group,
                          Math.max(0, Math.min(24, Math.round(n))),
                        ),
                      )
                    }
                  />
                  {rows.map((s) => (
                    <div className="role-shift" key={s.id}>
                      <div className="role-top">
                        <label className="scenario-input role-select">
                          <span>Role</span>
                          <select
                            aria-label={`${s.id} role`}
                            value={s.role}
                            onChange={(e) =>
                              patchPlan(
                                plan.map((p) =>
                                  p.id === s.id
                                    ? {
                                        ...p,
                                        role: e.target.value as StaffRole,
                                      }
                                    : p,
                                ),
                              )
                            }
                          >
                            {Object.entries(roleLabels)
                              .filter(
                                ([role]) =>
                                  roleGroup(role as StaffRole) === group,
                              )
                              .map(([role, name]) => (
                                <option key={role} value={role}>
                                  {name}
                                </option>
                              ))}
                          </select>
                        </label>
                        <NumberField
                          label="People"
                          value={s.count}
                          max={24}
                          onChange={(n) =>
                            patchPlan(
                              plan.map((p) =>
                                p.id === s.id
                                  ? {
                                      ...p,
                                      count: Math.max(
                                        0,
                                        Math.min(24, Math.round(n)),
                                      ),
                                    }
                                  : p,
                              ),
                            )
                          }
                        />
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`Remove ${roleLabels[s.role]} shift`}
                          onClick={() =>
                            patchPlan(plan.filter((p) => p.id !== s.id))
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="shift-times">
                        <TimeSelect
                          label="From"
                          value={s.start}
                          hours={c.hours}
                          opening={opening}
                          onChange={(n) =>
                            patchPlan(
                              plan.map((p) =>
                                p.id === s.id
                                  ? {
                                      ...p,
                                      start: Math.min(n, c.hours - 0.25),
                                      end: Math.min(
                                        c.hours,
                                        Math.max(p.end, n + 0.25),
                                      ),
                                    }
                                  : p,
                              ),
                            )
                          }
                        />
                        <TimeSelect
                          label="Until"
                          value={s.end}
                          hours={c.hours}
                          opening={opening}
                          onChange={(n) =>
                            patchPlan(
                              plan.map((p) =>
                                p.id === s.id
                                  ? {
                                      ...p,
                                      end: Math.max(0.25, n),
                                      start: Math.max(
                                        0,
                                        Math.min(p.start, n - 0.25),
                                      ),
                                    }
                                  : p,
                              ),
                            )
                          }
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="text-button"
                    disabled={plan.length >= 40}
                    onClick={() =>
                      patchPlan([
                        ...plan,
                        {
                          id: crypto.randomUUID(),
                          role: group === "back" ? "dishwasher" : group,
                          count: 1,
                          start: 0,
                          end: c.hours,
                        },
                      ])
                    }
                  >
                    <Plus size={13} />
                    Add{" "}
                    {group === "cook"
                      ? "cooking"
                      : group === "front"
                        ? "front room"
                        : "backroom"}{" "}
                    shift
                  </button>
                </section>
              );
            })}
            <p className="field-hint">
              Dedicated roles only perform their assigned tasks. Dishwashing
              reduces kitchen cleanup time; prep support speeds cooking. Add a
              second shift row for staggered coverage.
            </p>
          </>
        )}
        {tab === "hours" && (
          <>
            <div className="tab-intro">
              <h3>Your opening window</h3>
              <p>
                Store hours control all orders. Dining-room hours control when
                new parties can be seated.
              </p>
            </div>
            <label className="scenario-input">
              <span>Store opens</span>
              <select
                value={opening}
                onChange={(e) =>
                  onPatch(
                    setStoreHours(
                      c,
                      +e.target.value,
                      Math.min(c.hours, 24 - +e.target.value),
                    ),
                  )
                }
              >
                {Array.from({ length: 93 }, (_, i) => i / 4).map((n) => (
                  <option key={n} value={n}>
                    {clock(n)}
                  </option>
                ))}
              </select>
            </label>
            <NumberField
              label="Total store hours"
              value={c.hours}
              min={1}
              max={Math.min(12, 24 - opening)}
              step={0.25}
              onChange={(n) =>
                onPatch(
                  setStoreHours(
                    c,
                    opening,
                    Math.max(1, Math.min(12, 24 - opening, n)),
                  ),
                )
              }
            />
            <div className="hours-summary">
              Closes at <strong>{clock(opening + c.hours)}</strong>
            </div>
            {c.seats > 0 ? (
              <>
                <label className="toggle-row">
                  <span>
                    <strong>Dining room open</strong>
                    <small>
                      Pickup, delivery and drive-through follow store hours.
                    </small>
                  </span>
                  <input
                    type="checkbox"
                    checked={(c.diningEnd ?? c.hours) > (c.diningStart ?? 0)}
                    onChange={(e) =>
                      onPatch({
                        diningStart: 0,
                        diningEnd: e.target.checked ? c.hours : 0,
                      })
                    }
                  />
                </label>
                {(c.diningEnd ?? c.hours) > (c.diningStart ?? 0) && (
                  <div className="shift-times">
                    <TimeSelect
                      label="Dining opens"
                      value={c.diningStart ?? 0}
                      hours={c.hours}
                      opening={opening}
                      onChange={(n) =>
                        onPatch({
                          diningStart: Math.min(n, c.hours - 0.25),
                          diningEnd: Math.min(
                            c.hours,
                            Math.max(c.diningEnd ?? c.hours, n + 0.25),
                          ),
                        })
                      }
                    />
                    <TimeSelect
                      label="Dining closes"
                      value={c.diningEnd ?? c.hours}
                      hours={c.hours}
                      opening={opening}
                      onChange={(n) =>
                        onPatch({
                          diningEnd: Math.max(0.25, n),
                          diningStart: Math.max(
                            0,
                            Math.min(c.diningStart ?? 0, n - 0.25),
                          ),
                        })
                      }
                    />
                  </div>
                )}
              </>
            ) : (
              <p className="field-hint">
                0 seats · takeout only. There are no dining-room hours.
              </p>
            )}
            <p className="field-hint">
              Seated parties can finish after dining closes. Adjust front-room
              shifts in Staff to match. Changing store hours keeps shifts at
              their clock times where possible; review coverage afterward.
            </p>
          </>
        )}
        {tab === "menu" && (
          <>
            <div className="tab-intro">
              <h3>Price for demand and margin</h3>
              <p>
                Set individual prices, or apply an adjustment to every item.
                Food costs stay tied to portions, including free items.
              </p>
            </div>
            <Range
              label="All menu prices"
              value={c.priceChange}
              min={-30}
              max={50}
              onChange={(priceChange) => onPatch({ priceChange })}
            />
            <div className="item-price-list">
              {c.menu?.map((item) => (
                <div className="menu-price-row" key={item.name}>
                  <NumberField
                    label={item.name}
                    value={c.itemPrices?.[item.name] ?? item.price}
                    min={1}
                    max={200}
                    step={0.25}
                    onChange={(n) =>
                      onPatch({
                        itemPrices: { ...c.itemPrices, [item.name]: n },
                      })
                    }
                  />
                  <small>
                    {Math.round(item.popularity * 100)}% popular · after
                    adjustment $
                    {(
                      (c.itemPrices?.[item.name] ?? item.price) *
                      (1 + c.priceChange / 100)
                    ).toFixed(2)}
                  </small>
                </div>
              )) ?? (
                <p>Add a menu in Business data to edit individual prices.</p>
              )}
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => onPatch({ itemPrices: undefined, priceChange: 0 })}
            >
              Reset item prices
            </button>
            <div className="deal-heading">
              <h3>Deals & offers</h3>
              <span>{c.deals?.length ?? 0} / 12</span>
            </div>
            {c.deals?.map((deal) => (
              <div className="deal-card" key={deal.id}>
                <div className="deal-top">
                  <label>
                    <input
                      type="checkbox"
                      checked={deal.enabled}
                      onChange={(e) =>
                        dealPatch(deal.id, { enabled: e.target.checked })
                      }
                    />
                    {deal.type === "bogo"
                      ? "Buy one, get one free"
                      : "Order discount"}
                  </label>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Remove deal"
                    onClick={() =>
                      onPatch({
                        deals: c.deals?.filter((d) => d.id !== deal.id),
                      })
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {deal.type === "bogo" ? (
                  <label className="scenario-input">
                    <span>BOGO item</span>
                    <select
                      value={deal.item}
                      onChange={(e) =>
                        dealPatch(deal.id, { item: e.target.value })
                      }
                    >
                      {c.menu?.map((m) => (
                        <option key={m.name}>{m.name}</option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div className="shift-times">
                    <NumberField
                      label="Minimum order ($)"
                      value={deal.minimum}
                      min={1}
                      max={500}
                      onChange={(minimum) => dealPatch(deal.id, { minimum })}
                    />
                    <NumberField
                      label="Discount (%)"
                      value={deal.percent}
                      min={1}
                      max={70}
                      onChange={(percent) => dealPatch(deal.id, { percent })}
                    />
                  </div>
                )}
              </div>
            ))}
            <div className="deal-actions">
              <button
                type="button"
                className="button secondary"
                disabled={!c.menu?.length || (c.deals?.length ?? 0) >= 12}
                onClick={() => addDeal("bogo")}
              >
                <Plus size={13} />
                BOGO item
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={(c.deals?.length ?? 0) >= 12}
                onClick={() => addDeal("threshold")}
              >
                <Plus size={13} />
                Order discount
              </button>
            </div>
            <p className="field-hint">
              The largest eligible discount applies; deals don’t stack. The demo
              generates baskets of 1–3 portions. BOGO baskets contain two of the
              selected item.
            </p>
          </>
        )}
        {tab === "other" && (
          <>
            <div className="tab-intro">
              <h3>Plan for the unexpected</h3>
              <p>Test local events, holidays and a different mix of orders.</p>
            </div>
            <Range
              label="General demand change"
              value={c.demandChange}
              min={-50}
              max={100}
              onChange={(demandChange) => onPatch({ demandChange })}
            />
            <Range
              label="Holiday / event demand"
              value={c.holidayDemand ?? 0}
              min={-50}
              max={100}
              onChange={(holidayDemand) => onPatch({ holidayDemand })}
            />
            <div className="demand-presets">
              {[
                ["Normal day", 0],
                ["Local event", 25],
                ["Holiday rush", 60],
              ].map(([label, n]) => (
                <button
                  type="button"
                  key={label}
                  className={`button secondary ${(c.holidayDemand ?? 0) === n ? "selected" : ""}`}
                  onClick={() => onPatch({ holidayDemand: +n })}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="toggle-row">
              <span>
                <strong>Drive-through</strong>
                <small>A service lane sharing your kitchen.</small>
              </span>
              <input
                type="checkbox"
                checked={c.driveThrough}
                onChange={(e) => onPatch({ driveThrough: e.target.checked })}
              />
            </label>
            {c.driveThrough && (
              <Range
                label="Drive-through order share"
                value={c.driveShare}
                min={0}
                max={80}
                onChange={(driveShare) => onPatch({ driveShare })}
              />
            )}
            <p className="field-hint">
              Demand modifiers multiply with price effects and store hours.
              Drive-through needs general front staff, a cashier or a dedicated
              drive-through role.
            </p>
          </>
        )}
      </div>
      <div className="price-demand-preview">
        <span>
          Expected orders<strong>{forecast.orders}</strong>
        </span>
        <span>
          Demand effect of prices & deals
          <strong
            className={forecast.priceMultiplier >= 1 ? "positive" : "negative"}
          >
            {forecast.priceMultiplier >= 1 ? "+" : ""}
            {((forecast.priceMultiplier - 1) * 100).toFixed(1)}%
          </strong>
        </span>
        <p>
          Value and wait time both affect customer happiness. Run the scenario
          to see the combined outcome.
        </p>
      </div>
    </>
  );
}
