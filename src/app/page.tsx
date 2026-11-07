"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Onboarding, { Launch } from "./onboarding";
import { clock } from "@/lib/onboarding";
import VendorSummary from "./vendor-summary";
import Floor from "./restaurant-floor";
import ScenarioEditor from "./scenario-editor";
import { preservePay } from "@/lib/scenario-optimizer";
import { diningTableCount } from "@/lib/restaurant-layout";
import { toggleDrive } from "@/lib/service-quality";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ChefHat,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  FlaskConical,
  LayoutDashboard,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  Sparkles,
  Smile,
  Store,
  Upload,
  UtensilsCrossed,
  Wallet,
  X,
} from "lucide-react";
import {
  channelMix,
  Config,
  experiments,
  laborCost,
  exportCSV,
  Frame,
  presets,
  PresetId,
  simulate,
  validateConfig,
} from "@/lib/simulation";
const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
const labels = {
  dineIn: "Dine-in",
  pickup: "Pickup",
  doordash: "DoorDash",
  driveThrough: "Drive-through",
};
const colors = {
  dineIn: "#397b62",
  pickup: "#d4ac63",
  doordash: "#e58361",
  driveThrough: "#8c8dc2",
};
type View = "restaurant" | "lab" | "sous" | "data";
function download(name: string, content: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function Slider({
  label,
  value,
  onChange,
  min,
  max,
  unit = "",
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  unit?: string;
}) {
  return (
    <label className="slider-label">
      <span>
        {label}
        <b>
          {value}
          {unit}
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
        <small>
          {min}
          {unit}
        </small>
        <small>
          {max}
          {unit}
        </small>
      </span>
    </label>
  );
}
export default function Home() {
  const [setup, setSetup] = useState(true),
    [session, setSession] = useState<Launch | null>(null);
  const [view, setView] = useState<View>("restaurant"),
    [base, setBase] = useState<Config>({ ...presets.small.config }),
    [draft, setDraft] = useState<Config>({ ...presets.small.config }),
    [scenario, setScenario] = useState<Config | null>(null),
    [minute, setMinute] = useState(0),
    [playing, setPlaying] = useState(true),
    [speed, setSpeed] = useState(1),
    [notice, setNotice] = useState(""),
    [help, setHelp] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const baseline = useMemo(() => simulate(base), [base]),
    result = useMemo(
      () => (scenario ? simulate(scenario) : baseline),
      [scenario, baseline],
    ),
    ideas = useMemo(() => experiments(base), [base]);
  const active = scenario ?? base,
    frame =
      result.frames[Math.min(Math.floor(minute), result.frames.length - 1)],
    mix = channelMix(base),
    best = ideas[0];
  useEffect(() => {
    if (!playing || setup) return;
    let raf = 0,
      lastPaint = performance.now();
    const tick = (now: number) => {
      if (now - lastPaint >= 32) {
        const elapsed = Math.min(now - lastPaint, 120);
        setMinute((m) =>
          Math.min(result.frames.length - 1, m + (elapsed * speed) / 1000),
        );
        lastPaint = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, result.frames.length, setup]);
  useEffect(() => {
    if (minute >= result.frames.length - 1) setPlaying(false);
  }, [minute, result.frames.length]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(t);
  }, [notice]);
  function run(c = draft) {
    try {
      const locked = preservePay(base, c);
      validateConfig(locked);
      setScenario(locked);
      setMinute(0);
      setNotice(
        "Scenario calculated. Replay and compare against your baseline.",
      );
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  async function importConfig(f: File | undefined) {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const next = { ...base, ...data } as Config;
      validateConfig(next);
      setBase(next);
      setDraft(next);
      setScenario(null);
      setMinute(0);
      setNotice("Assumptions imported. Baseline recalculated.");
    } catch (e) {
      setNotice(`Import failed: ${(e as Error).message}`);
    } finally {
      if (file.current) file.current.value = "";
    }
  }
  const nav = [
    { id: "restaurant" as View, label: "My restaurant", icon: LayoutDashboard },
    { id: "lab" as View, label: "Scenario lab", icon: FlaskConical },
    { id: "sous" as View, label: "Sous insights", icon: Sparkles },
    { id: "data" as View, label: "Business data", icon: BarChart3 },
  ];
  const opening = active.openingHour ?? session?.day.opening ?? 17;
  if (setup)
    return (
      <Onboarding
        onStart={(launch) => {
          setSession(launch);
          setBase(launch.config);
          setDraft(launch.config);
          setScenario(null);
          setMinute(Math.round((launch.day.start - launch.day.opening) * 60));
          setPlaying(true);
          setView("restaurant");
          setSetup(false);
        }}
      />
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            setView("restaurant");
          }}
        >
          <span className="brand-mark">
            <UtensilsCrossed size={21} />
          </span>
          sous<span className="brand-dot">.</span>
        </a>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              className={view === n.id ? "nav active" : "nav"}
              onClick={() => setView(n.id)}
            >
              <n.icon size={19} />
              {n.label}
              {n.id === "sous" && (
                <span className="nav-count">{ideas.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="live-dot" /> A little foresight.
          <br />
          <strong>A better next shift.</strong>
          <p>
            Test your next move before
            <br />
            it becomes a real decision.
          </p>
          <div className="note-art">
            <ChefHat size={52} strokeWidth={1} />
            <Sparkles size={19} />
          </div>
        </div>
        <div className="sidebar-bottom">
          <button className="nav" onClick={() => setHelp(true)}>
            <CircleHelp size={18} />
            About this simulation
          </button>
          <div className="profile">
            <span>JK</span>
            <div>
              Jamie Kim<small>Restaurant owner · Demo</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            Workspace <ChevronRight size={14} />
            <span>Maple Street Kitchen</span>
          </div>
          <span className="demo-tag">
            <span className="live-dot" />
            SYNTHETIC DEMO
          </span>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">A LITTLE FORESIGHT GOES A LONG WAY</div>
              <h1>
                {view === "restaurant"
                  ? "Your next move, simulated."
                  : view === "lab"
                    ? "Good decisions start with “what if.”"
                    : view === "sous"
                      ? "A second set of eyes."
                      : "Meet your restaurant’s digital twin."}
              </h1>
              <p>
                {view === "restaurant"
                  ? "A living view of your restaurant. A clearer view of what comes next."
                  : view === "lab"
                    ? "Change an assumption. Run the shift. See what really makes a difference."
                    : view === "sous"
                      ? "Practical recommendations, grounded in your simulated operations."
                      : "Synthetic inputs, transparent assumptions, and data you can take with you."}
              </p>
            </div>
            <button
              className="button secondary heading-action"
              onClick={() => {
                setView("lab");
                setDraft({ ...base });
              }}
            >
              <FlaskConical size={16} />
              New scenario <ArrowUpRight size={15} />
            </button>
          </div>
          <section className="restaurant-strip">
            <span className="restaurant-icon">
              <Store size={23} />
            </span>
            <div>
              <h3>
                Maple Street Kitchen <span className="mini-tag">FICTIONAL</span>
              </h3>
              <p>
                {session?.day.day ?? "Friday"} <span>·</span> {clock(opening)}–
                {clock(opening + active.hours)} <span>·</span> Neighborhood
                burgers & good company
              </p>
            </div>
            <span className="preset-select">
              <Settings2 size={15} />
              {base.seats === 0
                ? "Takeout only"
                : `${base.seats} seats · ${diningTableCount(base)} tables`}{" "}
              · entered by you
            </span>
          </section>
          <div className="day-context">
            <span>
              <Clock3 size={14} />
              {session?.day.day ?? "Friday"} service <span>·</span>
              {base.inventory !== undefined
                ? `${base.inventory} opening portions · ${result.orders.filter((o) => o.stockout).length} stockout losses`
                : "Unlimited demo inventory"}
            </span>
            <button
              className="text-button"
              onClick={() => {
                setPlaying(false);
                setSetup(true);
              }}
            >
              New simulation / plan another day
              <ArrowRight size={13} />
            </button>
          </div>
          <section className="kpi-grid">
            {[
              {
                label: "Estimated shift profit",
                value: money(result.profit),
                icon: Wallet,
                sub: `${money(result.revenue)} in sales`,
                delta: scenario ? money(result.profit - baseline.profit) : null,
              },
              {
                label: "Orders fulfilled",
                value: `${result.completed}`,
                icon: UtensilsCrossed,
                sub: `of ${result.orders.length} orders received`,
                delta: scenario
                  ? `${result.completed - baseline.completed >= 0 ? "+" : ""}${result.completed - baseline.completed} orders`
                  : null,
              },
              {
                label: "Average order time",
                value: `${result.averageWait.toFixed(1)}`,
                suffix: " min",
                icon: Clock3,
                sub: `${result.p90Wait.toFixed(1)} min at the 90th percentile`,
                delta: scenario
                  ? `${(result.averageWait - baseline.averageWait).toFixed(1)} min`
                  : null,
              },
              {
                label: "Kitchen utilization",
                value: `${Math.round(result.utilization * 100)}`,
                suffix: "%",
                icon: ChefHat,
                sub: `${active.cooks} cooks · ${active.stations} kitchen stations`,
                delta: null,
              },
              {
                label: "Customer happiness",
                value: result.happiness.toFixed(1),
                suffix: " / 5",
                icon: Smile,
                sub: "Price, waits & unfulfilled orders",
                delta: scenario
                  ? `${result.happiness >= baseline.happiness ? "+" : ""}${(result.happiness - baseline.happiness).toFixed(1)} stars`
                  : null,
              },
            ].map((k, i) => (
              <article className="kpi" key={k.label}>
                <div className="kpi-top">
                  {k.label}
                  <k.icon size={17} />
                </div>
                <div className="kpi-value">
                  {k.value}
                  <span>{k.suffix}</span>
                </div>
                <div className="kpi-sub">
                  {k.delta ? (
                    <span
                      className={
                        (
                          i === 2
                            ? result.averageWait <= baseline.averageWait
                            : i === 1
                              ? result.completed >= baseline.completed
                              : i === 4
                                ? result.happiness >= baseline.happiness
                                : result.profit >= baseline.profit
                        )
                          ? "positive"
                          : "negative"
                      }
                    >
                      {k.delta} vs baseline
                    </span>
                  ) : (
                    k.sub
                  )}
                </div>
              </article>
            ))}
          </section>
          {(view === "restaurant" || view === "lab") && (
            <div className="content-grid">
              <div className="left-column">
                <section className="panel operations">
                  <div className="panel-heading">
                    <div>
                      <h2>Your restaurant, in motion</h2>
                      <p>Follow the flow from first order to final pickup.</p>
                    </div>
                    <span className="status-pill">
                      <span className="live-dot" />
                      {scenario ? "SCENARIO" : "BASELINE"}
                    </span>
                  </div>
                  <div className="floor-wrap">
                    <div className="floor-time">
                      <Clock3 size={13} />
                      {clock(opening + frame.minute / 60)}
                      <span>{session?.day.day ?? "Friday"} service</span>
                    </div>
                    <Floor
                      frame={frame}
                      config={active}
                      playing={playing}
                      orders={result.orders}
                      time={minute}
                    />
                    <div className="floor-legend">
                      <span>
                        <i style={{ background: "#74957d" }} />
                        Staff
                      </span>
                      <span>
                        <i style={{ background: "#daa178" }} />
                        Guests
                      </span>
                      <span>
                        <i style={{ background: "#d5ad75" }} />
                        Orders
                      </span>
                      <span className="floor-caption">
                        Every order has a journey
                      </span>
                    </div>
                  </div>
                  <div className="playback">
                    <button
                      aria-label={playing ? "Pause playback" : "Play playback"}
                      className="play-button"
                      onClick={() => setPlaying(!playing)}
                    >
                      {playing ? <Pause size={15} /> : <Play size={15} />}
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Restart replay"
                      onClick={() => setMinute(0)}
                    >
                      <RotateCcw size={15} />
                    </button>
                    <input
                      aria-label="Replay minute"
                      type="range"
                      min="0"
                      max={result.frames.length - 1}
                      value={Math.min(
                        Math.floor(minute),
                        result.frames.length - 1,
                      )}
                      onChange={(e) => {
                        setMinute(+e.target.value);
                        setPlaying(false);
                      }}
                    />
                    <span className="playback-time">
                      {frame.minute} / {result.frames.length - 1} min
                    </span>
                    <button
                      className="speed"
                      onClick={() => setSpeed((s) => (s === 4 ? 1 : s * 2))}
                    >
                      {speed}×
                    </button>
                  </div>
                  <div className="live-stats">
                    {[
                      { n: frame.queue, l: "In queue", c: "#dcaa68" },
                      { n: frame.cooking, l: "Cooking", c: "#67937b" },
                      { n: frame.ready, l: "At handoff", c: "#a7a5c0" },
                      { n: frame.completed, l: "Fulfilled", c: "#8b9d85" },
                    ].map((s) => (
                      <div key={s.l}>
                        <i style={{ background: s.c }} />
                        <strong>{s.n}</strong>
                        <span>{s.l}</span>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="panel trend-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>A shift at a glance</h2>
                      <p>Queue pressure through the evening</p>
                    </div>
                    <span className="chart-key">
                      <i />
                      Waiting orders
                    </span>
                  </div>
                  <svg
                    viewBox="0 0 700 135"
                    className="trend"
                    role="img"
                    aria-label={`Queue through shift, peak ${result.maxQueue} orders`}
                  >
                    <defs>
                      <linearGradient
                        id="chartFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0"
                          stopColor="#8eac91"
                          stopOpacity=".35"
                        />
                        <stop offset="1" stopColor="#8eac91" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {[25, 65, 105].map((y) => (
                      <path
                        key={y}
                        d={`M25 ${y}H680`}
                        stroke="#eceee6"
                        strokeDasharray="4 4"
                      />
                    ))}
                    <path
                      d={`M25 110 ${result.frames
                        .filter((_, i) => i % 4 === 0)
                        .map(
                          (f, i) =>
                            `L${25 + ((i * 4) / (result.frames.length - 1)) * 650} ${110 - (f.queue / Math.max(1, result.maxQueue)) * 85}`,
                        )
                        .join(" ")} L675 110Z`}
                      fill="url(#chartFill)"
                    />
                    <polyline
                      points={result.frames
                        .filter((_, i) => i % 4 === 0)
                        .map(
                          (f, i) =>
                            `${25 + ((i * 4) / (result.frames.length - 1)) * 650},${110 - (f.queue / Math.max(1, result.maxQueue)) * 85}`,
                        )
                        .join(" ")}
                      fill="none"
                      stroke="#6f9679"
                      strokeWidth="2.5"
                    />
                    {[0, 1, 2, 3, 4].map((i) => (
                      <text
                        key={i}
                        x={25 + i * 162}
                        y="130"
                        fill="#8d948b"
                        fontSize="10"
                      >
                        {clock(opening + (active.hours * i) / 4)}
                      </text>
                    ))}
                  </svg>
                </section>
              </div>
              <div className="right-column">
                {view === "lab" ? (
                  <ScenarioEditor
                    baseline={base}
                    draft={draft}
                    onPatch={(patch) => setDraft((d) => ({ ...d, ...patch }))}
                    onRun={() => run()}
                    onApply={(c) => {
                      setDraft(c);
                      run(c);
                    }}
                    onReset={() => {
                      setScenario(null);
                      setDraft({ ...base });
                      setMinute(0);
                    }}
                  />
                ) : (
                  <>
                    <section className="insight-card">
                      <div className="insight-label">
                        <Sparkles size={16} />A NOTE FROM SOUS
                      </div>
                      <h2>
                        {best.delta > 0
                          ? "A small change. A better shift."
                          : "Your baseline is holding up."}
                      </h2>
                      <p>
                        {best.delta > 0
                          ? `${best.name} could improve shift profit by ${money(best.delta)}. Let’s see how the evening plays out.`
                          : "The tested changes do not improve profit. Try a different level of demand in the scenario lab."}
                      </p>
                      <div className="opportunity">
                        <span>
                          Potential profit impact
                          <strong>
                            +{money(Math.max(0, best.delta))}
                            <small> / shift</small>
                          </strong>
                        </span>
                        <span className="opportunity-icon">
                          <ArrowUpRight size={25} />
                        </span>
                      </div>
                      <button
                        className="button primary full"
                        onClick={() => {
                          setView("lab");
                          setDraft(best.config);
                          run(best.config);
                        }}
                      >
                        Explore this scenario
                        <ArrowRight size={16} />
                      </button>
                      <div className="insight-footer">
                        Calculated from seeded simulations · no LLM
                      </div>
                    </section>
                    <section className="panel mix-card">
                      <div className="panel-heading">
                        <div>
                          <h2>Your order mix</h2>
                          <p>Different channels. One kitchen.</p>
                        </div>
                      </div>
                      <div className="mix-bar">
                        {Object.entries(mix).map(([k, v]) => (
                          <span
                            key={k}
                            style={{
                              width: `${v * 100}%`,
                              background: colors[k as keyof typeof colors],
                            }}
                          />
                        ))}
                      </div>
                      <div className="mix-list">
                        {Object.entries(mix)
                          .filter(([, v]) => v > 0)
                          .map(([k, v]) => (
                            <div key={k}>
                              <span>
                                <i
                                  style={{
                                    background:
                                      colors[k as keyof typeof colors],
                                  }}
                                />
                                {labels[k as keyof typeof labels]}
                              </span>
                              <strong>{(v * 100).toFixed(0)}%</strong>
                            </div>
                          ))}
                      </div>
                      <p className="mix-note">
                        Synthetic starting assumptions.
                        <br />
                        Adjust your setup in Business data.
                      </p>
                    </section>
                  </>
                )}
              </div>
            </div>
          )}
          {(view === "lab" || view === "sous") && (
            <section className="panel comparison">
              <div className="panel-heading">
                <div>
                  <h2>
                    {view === "sous"
                      ? "Good ideas earn their place."
                      : "The numbers behind your next move"}
                  </h2>
                  <p>
                    {view === "sous"
                      ? "Every suggestion is tested against your current baseline."
                      : "Full-shift outcomes, using identical random seeds."}
                  </p>
                </div>
                <span className="mini-tag">SEED {base.seed}</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Scenario</th>
                      <th>Profit</th>
                      <th>Fulfilled</th>
                      <th>Avg. time</th>
                      <th>Happiness</th>
                      <th>Labor</th>
                      <th>Profit impact</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <strong>Current baseline</strong>
                      </td>
                      <td>{money(baseline.profit)}</td>
                      <td>{baseline.completed}</td>
                      <td>{baseline.averageWait.toFixed(1)} min</td>
                      <td>{baseline.happiness.toFixed(1)} / 5</td>
                      <td>{money(baseline.labor)}</td>
                      <td>—</td>
                      <td />
                    </tr>
                    {(view === "sous"
                      ? ideas
                      : scenario
                        ? [
                            {
                              name: "Your scenario",
                              config: scenario,
                              result,
                              delta: result.profit - baseline.profit,
                            },
                          ]
                        : ideas.slice(0, 2)
                    ).map((s, i) => (
                      <tr key={i}>
                        <td>
                          <strong>{s.name}</strong>
                          <small>
                            {s.result.lost} lost · {s.result.unfinished}{" "}
                            unfinished
                          </small>
                        </td>
                        <td>{money(s.result.profit)}</td>
                        <td>{s.result.completed}</td>
                        <td>{s.result.averageWait.toFixed(1)} min</td>
                        <td
                          className={
                            s.result.happiness >= baseline.happiness
                              ? "positive"
                              : "negative"
                          }
                        >
                          {s.result.happiness.toFixed(1)} / 5
                        </td>
                        <td>{money(s.result.labor)}</td>
                        <td className={s.delta >= 0 ? "positive" : "negative"}>
                          {s.delta >= 0 ? "+" : ""}
                          {money(s.delta)}
                        </td>
                        <td>
                          <button
                            className="text-button"
                            onClick={() => {
                              setView("lab");
                              setDraft(s.config);
                              run(s.config);
                            }}
                          >
                            Replay
                            <ArrowRight size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {view === "sous" && (
                <div className="model-note">
                  <Sparkles size={17} />
                  <p>
                    <strong>Evidence first, advice second.</strong> These
                    recommendations rank four tested changes by estimated
                    profit. Price changes assume demand elasticity of 0.7.
                    Results are illustrative, not a real-world forecast.
                  </p>
                </div>
              )}
            </section>
          )}
          {view === "data" && (
            <div className="data-grid">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Restaurant assumptions</h2>
                    <p>Make the model your own.</p>
                  </div>
                  <Settings2 size={20} />
                </div>
                <div className="controls-body">
                  <Slider
                    label="Base orders per shift"
                    value={base.orders}
                    min={40}
                    max={400}
                    onChange={(v) => {
                      const c = { ...base, orders: v };
                      setBase(c);
                      setDraft(c);
                      setScenario(null);
                    }}
                  />
                  <label className="toggle-row">
                    <span>
                      <strong>Drive-through</strong>
                      <small>A separate service lane, shared kitchen.</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={base.driveThrough}
                      onChange={(e) => {
                        const c = toggleDrive(base, e.target.checked);
                        setBase(c);
                        setDraft(c);
                        setScenario(null);
                      }}
                    />
                  </label>
                  {base.driveThrough && (
                    <Slider
                      label="Drive-through share"
                      value={base.driveShare}
                      min={5}
                      max={60}
                      unit="%"
                      onChange={(v) => {
                        const c = { ...base, driveShare: v };
                        setBase(c);
                        setDraft(c);
                        setScenario(null);
                      }}
                    />
                  )}
                  <div className="assumption-grid">
                    {[
                      ["Dining tables", diningTableCount(base)],
                      ["Seats", base.seats],
                      ["Kitchen stations", base.stations],
                      ["Avg. ticket", money(base.ticket)],
                      ["Food cost", `${base.foodCost * 100}%`],
                      ["DoorDash fee", `${base.fee * 100}%`],
                      ["Shift overhead", money(base.overhead)],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <small>{k}</small>
                        <strong>{v}</strong>
                      </div>
                    ))}
                  </div>
                  <p className="muted small">
                    Export and edit the configuration JSON to override
                    additional assumptions, then import it here. Drive-through
                    share reduces all other channels proportionally.
                  </p>
                  <div className="button-row">
                    <button
                      className="button secondary"
                      onClick={() =>
                        download(
                          "sous-config.json",
                          JSON.stringify(base, null, 2),
                          "application/json",
                        )
                      }
                    >
                      <Download size={15} />
                      Export setup
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => file.current?.click()}
                    >
                      <Upload size={15} />
                      Import JSON
                    </button>
                    <input
                      type="file"
                      ref={file}
                      accept=".json,application/json"
                      hidden
                      onChange={(e) => void importConfig(e.target.files?.[0])}
                    />
                  </div>
                </div>
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Where the money goes</h2>
                    <p>Baseline shift economics</p>
                  </div>
                  <Wallet size={20} />
                </div>
                <div className="finance-list">
                  {[
                    ["Gross sales", baseline.revenue],
                    ["Food (including waste)", -baseline.food],
                    ["Platform fees", -baseline.fees],
                    ["Staff wages", -baseline.labor],
                    ["Packaging & variable services", -baseline.supplies],
                    ["Fixed shift overhead", -baseline.overhead],
                    ["Estimated shift profit", baseline.profit],
                  ].map(([k, v], i) => (
                    <div key={k} className={i === 6 ? "finance-total" : ""}>
                      <span>{k}</span>
                      <strong>{money(v as number)}</strong>
                    </div>
                  ))}
                </div>
                <div className="model-note">
                  <CircleHelp size={18} />
                  <p>
                    Only fulfilled orders earn revenue. Food used on lost and
                    unfinished orders still incurs cost. Labor and overhead
                    cover the entire shift.
                  </p>
                </div>
              </section>
              {base.vendorItems?.length ? (
                <VendorSummary result={baseline} config={base} />
              ) : null}
              <section className="panel data-orders">
                <div className="panel-heading">
                  <div>
                    <h2>Synthetic order ledger</h2>
                    <p>
                      {baseline.orders.length} generated orders · seed{" "}
                      {base.seed} · no real customer data
                    </p>
                  </div>
                  <button
                    className="button secondary"
                    onClick={() =>
                      download(
                        "maple-street-orders.csv",
                        exportCSV(baseline),
                        "text/csv",
                      )
                    }
                  >
                    <Download size={15} />
                    Export CSV
                  </button>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Channel</th>
                        <th>Arrives after</th>
                        <th>Subtotal</th>
                        <th>Order time</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {baseline.orders.slice(0, 20).map((o) => (
                        <tr key={o.id}>
                          <td>{o.id}</td>
                          <td>{labels[o.channel]}</td>
                          <td>{o.arrival.toFixed(1)} min</td>
                          <td>{money(o.subtotal)}</td>
                          <td>{o.wait.toFixed(1)} min</td>
                          <td>
                            <span className={`order-status ${o.status}`}>
                              {o.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="table-foot">
                  Showing the first 20 orders. Export CSV for the complete
                  shift.
                </p>
              </section>
            </div>
          )}
          <footer>
            <span>
              <span className="live-dot" /> Built for better tomorrows.
            </span>
            <span>
              SOUS × NOVA <span className="footer-sep">/</span> Simulated data.
              Real possibilities.
            </span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="About the model"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon-button modal-close"
              aria-label="Close"
              onClick={() => setHelp(false)}
            >
              <X />
            </button>
            <ChefHat size={32} />
            <h2>Foresight, with the assumptions in view.</h2>
            <p>
              Sous is a hackathon prototype for a fictional restaurant. All
              orders and operating defaults are synthetic, not DoorDash data or
              industry benchmarks.
            </p>
            <p>
              A seeded queue simulation routes orders through cooks, physical
              stations, seating, and handoff staff. Orders can abandon the queue
              or remain unfinished at closing.
            </p>
            <p>
              Store hours scale expected order volume. Dining-room hours route
              guests to takeout channels when the room is closed. Roles and
              shifts limit cooking, service, bussing and backroom support. Menu
              prices and deals affect demand, value ratings and food use.
            </p>
            <p>
              Cards show whole-shift outcomes; the floor and timeline replay
              individual minutes. Ask Sous tests staffing and menu prices with
              pay rates, hours and demand assumptions fixed. It prioritizes
              profit, then the shortest wait among equally profitable choices.
            </p>
            <p>
              Customer happiness is a modeled 1–5 rating based on menu-price
              changes and order waiting times, including lost and unfinished
              orders. It is not an imported customer-review score.
            </p>
            <button className="button primary" onClick={() => setHelp(false)}>
              Back to the restaurant
              <ArrowRight size={16} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
