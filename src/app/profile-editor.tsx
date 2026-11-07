"use client";
import { MenuItem } from "@/lib/simulation";
import { parseTime } from "@/lib/onboarding";
export type ProfileFields = {
  opening: number;
  closing: number;
  orders: number;
  menu: MenuItem[];
};
const timeValue = (n: number) =>
  Number.isFinite(n)
    ? `${String(Math.floor(n)).padStart(2, "0")}:${String(Math.round((n % 1) * 60)).padStart(2, "0")}`
    : "";
export default function ProfileEditor({
  profile,
  onChange,
}: {
  profile: ProfileFields;
  onChange: (patch: Partial<ProfileFields>) => void;
}) {
  return (
    <details className="profile-corrections">
      <summary>Something missing or incorrect in the DoorDash profile?</summary>
      <p>
        Most details are already loaded. Open this section only to correct
        something before reviewing.
      </p>
      <div className="review-pair">
        <label className="setup-field">
          <span>Expected base orders / day</span>
          <input
            type="number"
            min="10"
            max="1000"
            value={profile.orders}
            onChange={(e) => onChange({ orders: +e.target.value })}
          />
        </label>
        {(["opening", "closing"] as const).map((k) => (
          <label className="setup-field" key={k}>
            <span>{k === "opening" ? "Opening time" : "Closing time"}</span>
            <input
              type="time"
              value={timeValue(profile[k])}
              onChange={(e) => onChange({ [k]: parseTime(e.target.value) })}
              onInput={(e) =>
                onChange({ [k]: parseTime(e.currentTarget.value) })
              }
            />
          </label>
        ))}
      </div>
      <h3>Imported menu</h3>
      {profile.menu.map((m, i) => (
        <div className="profile-menu-editor" key={i}>
          <label className="setup-field">
            <span>Menu item</span>
            <input
              aria-label={`Menu item ${i + 1} name`}
              value={m.name}
              onChange={(e) =>
                onChange({
                  menu: profile.menu.map((v, j) =>
                    j === i ? { ...v, name: e.target.value } : v,
                  ),
                })
              }
            />
          </label>
          <label className="setup-field">
            <span>Price ($)</span>
            <input
              aria-label={`Menu item ${i + 1} price`}
              type="number"
              min="1"
              max="200"
              step=".01"
              value={m.price}
              onChange={(e) =>
                onChange({
                  menu: profile.menu.map((v, j) =>
                    j === i ? { ...v, price: +e.target.value } : v,
                  ),
                })
              }
            />
          </label>
          <label className="setup-field">
            <span>Popularity (%)</span>
            <input
              aria-label={`Menu item ${i + 1} popularity`}
              type="number"
              min="0"
              max="100"
              step="1"
              value={Math.round(m.popularity * 100)}
              onChange={(e) =>
                onChange({
                  menu: profile.menu.map((v, j) =>
                    j === i ? { ...v, popularity: +e.target.value / 100 } : v,
                  ),
                })
              }
            />
          </label>
        </div>
      ))}
      <p className="field-hint">
        Popularity shares must add up to 100%. Menu prices and popularity feed
        the generated orders.
      </p>
    </details>
  );
}
