"use client";
export default function ManualLayout({
  seats,
  stations,
  onSeats,
  onStations,
}: {
  seats: number;
  stations: number;
  onSeats: (n: number) => void;
  onStations: (n: number) => void;
}) {
  return (
    <section className="panel manual-layout">
      <div className="eyebrow">TELL US ABOUT YOUR SPACE</div>
      <h2>Two details about your space.</h2>
      <p>
        Enter your kitchen stations and dining seats. These details aren’t
        available from DoorDash.
      </p>
      <div className="manual-layout-grid">
        {[
          {
            label: "Kitchen stations",
            value: stations,
            min: 1,
            max: 12,
            step: 1,
            change: onStations,
          },
          {
            label: "Number of seats",
            value: seats,
            min: 0,
            max: 2000,
            step: 1,
            change: onSeats,
          },
        ].map((f) => (
          <label className="setup-field" key={f.label}>
            <span>{f.label}</span>
            <input
              type="number"
              required
              min={f.min}
              max={f.max}
              step={f.step}
              placeholder="Enter a number"
              value={Number.isFinite(f.value) ? f.value : ""}
              onChange={(e) =>
                f.change(e.target.value === "" ? NaN : +e.target.value)
              }
            />
          </label>
        ))}
      </div>
      <div className="manual-layout-hint">
        {seats === 0
          ? "Takeout only. Your floor will have no dining tables."
          : Number.isFinite(seats) && seats > 0
            ? `${Math.floor(seats / 4)} four-person tables${seats % 4 ? ` and one ${seats % 4}-person table` : ""}. Parties are seated at tables that fit their group.`
            : "Enter any whole number up to 2,000 seats. Use 0 for takeout only. Most tables seat four; remaining seats form a smaller table."}
      </div>
    </section>
  );
}
