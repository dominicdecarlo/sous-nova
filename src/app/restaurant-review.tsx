import { ArrowLeft, ArrowRight, Check, Clock3, Store } from "lucide-react";
import { MenuItem, presets, PresetId } from "@/lib/simulation";
import { clock, Day, weekdays } from "@/lib/onboarding";
import DoorDashLogo from "./doordash-logo";
export function RestaurantReview({
  preset,
  opening,
  closing,
  orders,
  seats,
  tables,
  stations,
  menu,
  inventory,
  staffCount,
  onBack,
  onContinue,
}: {
  preset: PresetId;
  opening: number;
  closing: number;
  orders: number;
  seats: number;
  tables: number;
  stations: number;
  menu: MenuItem[];
  inventory: string;
  staffCount: number;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <>
      <section className="panel ready-card">
        <div className="ready-banner">
          <span className="ready-icon">
            <Check size={24} />
          </span>
          <div>
            <h2>Maple Street Kitchen is ready.</h2>
            <p>Your restaurant profile and operating details are in place.</p>
          </div>
          <DoorDashLogo compact />
        </div>
        <div className="preloaded-heading">
          <Store size={15} />
          <strong>Restaurant profile</strong>
          <span>From DoorDash</span>
        </div>
        <div className="preloaded-grid">
          {[
            ["Opening hours", `${clock(opening)}–${clock(closing)}`],
            ["Expected volume", `${orders} orders / day`],
          ].map(([name, value]) => (
            <div key={name}>
              <small>{name}</small>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <div className="preloaded-heading">
          <strong>Your restaurant layout & operations</strong>
          <span>Entered by you</span>
        </div>
        <div className="preloaded-grid">
          {[
            [
              "Dining room",
              seats === 0
                ? "Takeout only · no dining tables"
                : `${Math.ceil(seats / 4)} tables · ${seats} seats`,
            ],
            ["Kitchen", `${stations} stations`],
            [
              "Operating details",
              `${staffCount} staff · ${inventory} portions`,
            ],
          ].map(([name, value]) => (
            <div key={name}>
              <small>{name}</small>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <div className="preloaded-heading">
          <strong>Menu & customer favorites</strong>
          <span>Prices and order popularity</span>
        </div>
        <div className="table-scroll">
          <table className="menu-preview">
            <thead>
              <tr>
                <th>Menu item</th>
                <th>Price</th>
                <th>Popularity</th>
              </tr>
            </thead>
            <tbody>
              {menu.map((item, i) => (
                <tr key={i}>
                  <td>
                    {item.name}
                    {i === 0 && (
                      <span className="favorite-label">GUEST FAVORITE</span>
                    )}
                  </td>
                  <td>${item.price.toFixed(2)}</td>
                  <td>
                    <span className="popularity-bar">
                      <i style={{ width: `${item.popularity * 100}%` }} />
                    </span>
                    {(item.popularity * 100).toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="ready-footnote">
          <Check size={14} />
          Seats, kitchen stations and operating details added by you. Tables are
          arranged automatically, mostly with four seats each.
        </div>
      </section>
      <div className="setup-actions">
        <button className="button secondary" onClick={onBack}>
          <ArrowLeft size={15} />
          Go back & correct something
        </button>
        <button className="button primary" onClick={onContinue}>
          Looks good, continue
          <ArrowRight size={16} />
        </button>
      </div>
    </>
  );
}
export function SchedulePicker({
  day,
  onDay,
  opening,
  closing,
  skip,
  onSkip,
  start,
  onStart,
  onBack,
  onLaunch,
}: {
  day: Day;
  onDay: (d: Day) => void;
  opening: number;
  closing: number;
  skip: boolean;
  onSkip: (v: boolean) => void;
  start: number;
  onStart: (value: string) => void;
  onBack: () => void;
  onLaunch: () => void;
}) {
  const h = Math.floor(start),
    min = Math.round((start % 1) * 60);
  return (
    <>
      <section className="panel review-card schedule-card">
        <div className="schedule-hours">
          <Clock3 size={18} />
          <span>
            Opening hours{" "}
            <strong>
              {clock(opening)}–{clock(closing)}
            </strong>
          </span>
        </div>
        <label className="setup-field">
          <span>Day of the week</span>
          <select value={day} onChange={(e) => onDay(e.target.value as Day)}>
            {weekdays.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <p className="field-hint">
          The selected day’s demand pattern is applied automatically.
        </p>
        <fieldset className="start-options">
          <legend>When should the day begin?</legend>
          <label className={!skip ? "selected" : ""}>
            <input
              type="radio"
              name="start-mode"
              checked={!skip}
              onChange={() => onSkip(false)}
            />
            <div>
              <strong>At opening</strong>
              <small>Start at {clock(opening)}, before the first order.</small>
            </div>
            <Clock3 size={18} />
          </label>
          <label className={skip ? "selected" : ""}>
            <input
              type="radio"
              name="start-mode"
              checked={skip}
              onChange={() => onSkip(true)}
            />
            <div>
              <strong>Skip to a time</strong>
              <small>Catch up with the restaurant later in the day.</small>
            </div>
            <ArrowRight size={18} />
          </label>
        </fieldset>
        {skip && (
          <label className="setup-field">
            <span>Jump to</span>
            <input
              type="time"
              value={
                Number.isFinite(start)
                  ? `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`
                  : ""
              }
              onChange={(e) => onStart(e.target.value)}
              onInput={(e) => onStart(e.currentTarget.value)}
            />
          </label>
        )}
        <p className="field-hint">
          Earlier orders, inventory use, queues and costs are preserved when you
          skip ahead.
        </p>
      </section>
      <div className="setup-actions">
        <button className="button secondary" onClick={onBack}>
          <ArrowLeft size={15} />
          Back to restaurant review
        </button>
        <button className="button primary" onClick={onLaunch}>
          Start {day}
          <ArrowRight size={16} />
        </button>
      </div>
    </>
  );
}
