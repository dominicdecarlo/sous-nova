"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChefHat,
  Clock3,
  Download,
  LoaderCircle,
  Plus,
  Sparkles,
  Store,
  Upload,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { Config, presets, PresetId, StaffMember } from "@/lib/simulation";
import {
  demoVendors,
  demoFixedCosts,
  FixedCost,
  VendorLine,
  validateVendors,
  validateFixedCosts,
} from "@/lib/costs";
import {
  importedMenu,
  importedRestaurant,
  menuTicket,
} from "@/lib/restaurant-profile";
import CostEditor from "./cost-editor";
import DoorDashLogo from "./doordash-logo";
import ProfileEditor, { ProfileFields } from "./profile-editor";
import ManualLayout from "./manual-layout";
import { validatePhysicalLayout } from "@/lib/restaurant-layout";
import { RestaurantReview, SchedulePicker } from "./restaurant-review";
import {
  buildDay,
  clock,
  Day,
  DaySetup,
  fieldNames,
  Operations,
  parseTime,
  required,
  sampleDocument,
  Scan,
  weekdays,
} from "@/lib/onboarding";
type Phase = "start" | "loading" | "details" | "review" | "schedule";
type Inputs = {
  inventory: string;
  foodCost: string;
  vendorCost: string;
  otherCost: string;
};
export type Launch = { config: Config; day: DaySetup; operations: Operations };
const timeValue = (n: number) =>
  `${String(Math.floor(n)).padStart(2, "0")}:${String(Math.round((n % 1) * 60)).padStart(2, "0")}`;
export default function Onboarding({
  onStart,
}: {
  onStart: (launch: Launch) => void;
}) {
  const [phase, setPhase] = useState<Phase>("start"),
    [progress, setProgress] = useState(0),
    [section, setSection] = useState(0),
    [fields, setFields] = useState<Inputs>({
      inventory: "",
      foodCost: "",
      vendorCost: "",
      otherCost: "",
    }),
    [staff, setStaff] = useState<StaffMember[]>([]),
    [scanning, setScanning] = useState(false),
    [message, setMessage] = useState(""),
    [scan, setScan] = useState<Scan | null>(null),
    [sources, setSources] = useState<string[]>([]),
    [day, setDay] = useState<Day>("Friday"),
    [opening, setOpening] = useState(importedRestaurant.opening),
    [closing, setClosing] = useState(importedRestaurant.closing),
    [skip, setSkip] = useState(false),
    [start, setStart] = useState(17),
    [orders, setOrders] = useState(importedRestaurant.orders),
    [seats, setSeats] = useState(NaN),
    [stations, setStations] = useState(NaN),
    [menu, setMenu] = useState(importedMenu.map((m) => ({ ...m }))),
    [itemized, setItemized] = useState(false),
    [vendors, setVendors] = useState<VendorLine[]>([]),
    [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]),
    [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    uploadRun = useRef(0);
  const preset: PresetId =
      seats === 0 ? "takeout" : seats > 80 ? "large" : "small",
    tables = Math.ceil(seats / 4),
    drive = false,
    driveShare = 20;
  useEffect(() => {
    if (phase !== "loading") return;
    const t = setInterval(() => setProgress((p) => Math.min(100, p + 5)), 120);
    return () => clearInterval(t);
  }, [phase]);
  useEffect(() => {
    if (phase === "loading" && progress === 100) {
      const t = setTimeout(() => setPhase("details"), 350);
      return () => clearTimeout(t);
    }
  }, [phase, progress]);
  let validVendors = true,
    validFixedCosts = true;
  try {
    validateVendors(vendors);
  } catch {
    validVendors = false;
  }
  try {
    validateFixedCosts(fixedCosts);
  } catch {
    validFixedCosts = false;
  }
  const completed = {
    inventory:
      fields.inventory !== "" &&
      Number.isInteger(+fields.inventory) &&
      +fields.inventory >= 0 &&
      +fields.inventory <= 10000,
    foodCost:
      fields.foodCost !== "" &&
      +fields.foodCost >= 0 &&
      +fields.foodCost <= 100,
    vendorCost: itemized
      ? vendors.length > 0 && validVendors
      : fields.vendorCost !== "" &&
        +fields.vendorCost >= 0 &&
        +fields.vendorCost <= 5000,
    otherCost: itemized
      ? fixedCosts.length > 0 && validFixedCosts
      : fields.otherCost !== "" &&
        +fields.otherCost >= 0 &&
        +fields.otherCost <= 5000,
    staff:
      staff.length > 0 &&
      staff.some((s) => s.role === "cook") &&
      staff.some((s) => s.role === "front") &&
      staff.every(
        (s) =>
          s.name.trim() &&
          Number.isFinite(s.start) &&
          Number.isFinite(s.end) &&
          s.start >= 0 &&
          s.end <= 24 &&
          s.end > s.start &&
          s.pay >= 1 &&
          s.pay <= 100,
      ),
  };
  const missing = required.filter((k) => !completed[k]);
  let layoutComplete = true;
  try {
    validatePhysicalLayout(preset, seats, tables, stations);
  } catch {
    layoutComplete = false;
  }
  const operations = (): Operations => ({
    inventory: +fields.inventory,
    foodCost: +fields.foodCost / 100,
    vendorCost: itemized ? 0 : +fields.vendorCost,
    otherCost: itemized
      ? fixedCosts.reduce((sum, v) => sum + v.amount, 0)
      : +fields.otherCost,
    vendorItems: itemized ? vendors : undefined,
    fixedCosts: itemized ? fixedCosts : undefined,
    staff,
  });
  function applyScan(found: Partial<Operations>) {
    setFields((prev) => ({
      ...prev,
      ...(found.inventory !== undefined
        ? { inventory: String(found.inventory) }
        : {}),
      ...(found.foodCost !== undefined
        ? { foodCost: String(found.foodCost * 100) }
        : {}),
      ...(found.vendorCost !== undefined
        ? { vendorCost: String(found.vendorCost) }
        : {}),
      ...(found.otherCost !== undefined
        ? { otherCost: String(found.otherCost) }
        : {}),
    }));
    if (found.staff) setStaff(found.staff);
    if (found.vendorItems) {
      setItemized(true);
      setVendors((prev) => {
        const merged = [...prev];
        for (const next of found.vendorItems!) {
          const index = merged.findIndex(
            (v) =>
              v.supplier.toLowerCase() === next.supplier.toLowerCase() &&
              v.item.toLowerCase() === next.item.toLowerCase(),
          );
          if (index >= 0) merged[index] = { ...next, id: merged[index].id };
          else merged.push({ ...next, id: crypto.randomUUID() });
        }
        return merged;
      });
    }
    if (found.fixedCosts) {
      setItemized(true);
      setFixedCosts((prev) => {
        const merged = [...prev];
        for (const next of found.fixedCosts!) {
          const index = merged.findIndex(
            (v) => v.name.toLowerCase() === next.name.toLowerCase(),
          );
          if (index >= 0) merged[index] = { ...next, id: merged[index].id };
          else merged.push({ ...next, id: crypto.randomUUID() });
        }
        return merged;
      });
    }
    if (found.vendorItems && !found.fixedCosts) {
      const total =
        found.otherCost ??
        (fields.otherCost !== "" ? Number(fields.otherCost) : undefined);
      if (total !== undefined)
        setFixedCosts((prev) =>
          prev.length
            ? prev
            : [
                {
                  id: crypto.randomUUID(),
                  name: "Other operating costs",
                  amount: total,
                },
              ],
        );
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setMessage("Choose a file under 8 MB, or enter the details manually.");
      return;
    }
    const run = ++uploadRun.current;
    setScanning(true);
    setMessage("");
    try {
      const data = new FormData();
      data.append("file", file);
      const response = await fetch("/api/scan", { method: "POST", body: data });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Could not read the document.");
      if (run !== uploadRun.current) return;
      const result = body as Scan;
      setScan(result);
      applyScan(result.found);
      setSources((s) => [...s, file.name]);
      setMessage(
        Object.keys(result.found).length
          ? "Found information has been added below. Review it before continuing."
          : "No setup fields were recognized. Upload another document or fill in the missing details below.",
      );
    } catch (e) {
      if (run === uploadRun.current) setMessage((e as Error).message);
    } finally {
      if (run === uploadRun.current) {
        setScanning(false);
        if (input.current) input.current.value = "";
      }
    }
  }
  async function dropFiles(files: FileList) {
    if (scanning) return;
    if (files.length !== 1) {
      setMessage(
        "Drop one document at a time. You can add another after it is read.",
      );
      return;
    }
    await upload(files[0]);
  }
  function changeProfile(patch: Partial<ProfileFields>) {
    if (patch.opening !== undefined) setOpening(patch.opening);
    if (patch.closing !== undefined) setClosing(patch.closing);
    if (patch.orders !== undefined) setOrders(patch.orders);
    if (patch.menu) setMenu(patch.menu);
  }
  function sample() {
    const blob = new Blob([sampleDocument], { type: "text/plain" }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "maple-street-operations.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function demo() {
    setSeats(32);
    setStations(5);
    setVendors(demoVendors.map((v) => ({ ...v })));
    setFixedCosts(demoFixedCosts.map((v) => ({ ...v })));
    applyScan({
      inventory: 240,
      foodCost: 0.31,
      vendorCost: 85,
      otherCost: 75,
      vendorItems: demoVendors,
      fixedCosts: demoFixedCosts,
      staff: [
        { name: "Alex", role: "cook", start: 11, end: 21, pay: 22 },
        { name: "Sam", role: "cook", start: 11, end: 21, pay: 20 },
        { name: "Jordan", role: "front", start: 11, end: 21, pay: 18 },
        { name: "Riley", role: "front", start: 15, end: 21, pay: 18 },
      ],
    });
    setMessage(
      "Demo assumptions filled in. You can edit every value before opening.",
    );
    setScan(null);
  }
  function continueSetup() {
    try {
      validatePhysicalLayout(preset, seats, tables, stations);
    } catch (e) {
      setMessage((e as Error).message);
      return;
    }
    if (missing.length) {
      setMessage(
        `Still needed: ${missing.map((k) => fieldNames[k]).join(", ")}. Upload another file or enter these manually.`,
      );
      setSection(
        !completed.inventory || !completed.foodCost
          ? 0
          : !completed.staff
            ? 1
            : 2,
      );
      return;
    }
    setMessage("");
    try {
      buildDay(
        preset,
        operations(),
        { day, opening, closing, start: opening },
        {
          orders,
          driveThrough: drive,
          driveShare,
          seats,
          tables,
          stations,
          menu,
        },
      );
    } catch (e) {
      setMessage((e as Error).message);
      return;
    }
    setPhase("review");
  }
  function launch() {
    try {
      validatePhysicalLayout(preset, seats, tables, stations);
      if (missing.length)
        throw new Error("Finish the missing operating details first.");
      const schedule = { day, opening, closing, start: skip ? start : opening };
      const ops = operations();
      const config = buildDay(preset, ops, schedule, {
        orders,
        driveThrough: drive,
        driveShare,
        seats,
        tables,
        stations,
        menu,
      });
      onStart({ config, day: schedule, operations: ops });
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  const numberField = (
    key: keyof Inputs,
    label: string,
    suffix: string,
    min = 0,
    max = 5000,
  ) => (
    <label className="setup-field" key={key}>
      <span>{label}</span>
      <div>
        <input
          type="number"
          min={min}
          max={max}
          step={key === "inventory" ? 1 : 0.01}
          placeholder="Enter amount"
          value={fields[key]}
          onChange={(e) => setFields((p) => ({ ...p, [key]: e.target.value }))}
        />
        <small>{suffix}</small>
      </div>
    </label>
  );
  const brand = (
    <a
      href="#"
      className="setup-brand"
      onClick={(e) => {
        e.preventDefault();
        setPhase("start");
        setMessage("");
      }}
    >
      <span>
        <UtensilsCrossed size={19} />
      </span>
      sous.
    </a>
  );
  if (phase === "start")
    return (
      <div className="setup-shell">
        <header className="setup-header">
          {brand}
          <span className="demo-tag">SOUS × NOVA · INTERACTIVE DEMO</span>
        </header>
        <main className="welcome">
          <section>
            <div className="eyebrow">YOUR RESTAURANT. YOUR NEXT CHAPTER.</div>
            <h1>
              Tomorrow’s shift.
              <br />
              Today’s possibilities.
            </h1>
            <p>
              Build a little version of your restaurant. Meet your team, plan
              the day, and see what your next decision could change.
            </p>
            <button
              className="button primary welcome-button"
              onClick={() => {
                setProgress(0);
                setPhase("loading");
              }}
            >
              <Plus size={19} />
              New simulation
              <ArrowRight size={18} />
            </button>
            <div className="welcome-detail">
              <Clock3 size={14} />
              About two minutes to set up. A whole day to explore.
            </div>
            <div className="welcome-disclosure">
              Menu, hours and customer favorites, ready when you are.
            </div>
          </section>
          <section
            className="welcome-restaurant"
            aria-label="Restaurant simulation preview"
          >
            <span className="welcome-badge">
              <span className="live-dot" />A NEW DAY AT MAPLE STREET
            </span>
            <div className="restaurant-mini">
              <div className="mini-kitchen">
                <ChefHat size={38} />
                <span>THE KITCHEN</span>
                <div className="mini-stations">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
              <div className="mini-dining">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="mini-table">
                    <i />
                    <span />
                    <i />
                  </div>
                ))}
              </div>
              <div className="mini-counter">
                <Store size={18} />
                MAPLE STREET KITCHEN
              </div>
            </div>
            <div className="welcome-caption">
              <Sparkles size={19} />
              <div>
                A little foresight goes a long way.
                <small>From opening prep to the last order of the night.</small>
              </div>
            </div>
          </section>
        </main>
        <div className="welcome-bottom">
          A safe place to try your next big idea.
        </div>
      </div>
    );
  return (
    <div className="setup-shell">
      <header className="setup-header">
        {brand}
        <button
          className="text-button"
          onClick={() => {
            uploadRun.current++;
            setScanning(false);
            setPhase("start");
            setMessage("");
          }}
        >
          <X size={14} />
          Exit setup
        </button>
      </header>
      <main className="setup-main">
        <div className="setup-steps">
          {[
            "Restaurant profile",
            "Operating details",
            "Ready to start?",
            "Choose your day",
          ].map((s, i) => (
            <div
              key={s}
              className={
                (phase === "loading"
                  ? 0
                  : phase === "details"
                    ? 1
                    : phase === "review"
                      ? 2
                      : 3) >= i
                  ? "current"
                  : ""
              }
            >
              <span>
                {(phase === "loading"
                  ? 0
                  : phase === "details"
                    ? 1
                    : phase === "review"
                      ? 2
                      : 3) > i ? (
                  <Check size={13} />
                ) : (
                  i + 1
                )}
              </span>
              {s}
            </div>
          ))}
        </div>
        {phase === "loading" ? (
          <section className="loading-card">
            <span className="sync-icon">
              <DoorDashLogo compact />
            </span>
            <div className="eyebrow">PULLING FROM DOORDASH</div>
            <h1>Pulling from DoorDash.</h1>
            <p>
              Bringing your menu, order history, and restaurant profile into one
              place.
            </p>
            <div
              className="import-progress"
              role="progressbar"
              aria-label="DoorDash restaurant import"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
            <div className="progress-caption">
              <span>
                {progress < 30
                  ? "Reading restaurant profile…"
                  : progress < 60
                    ? "Bringing in menu and order mix…"
                    : progress < 90
                      ? "Pulling order history and customer favorites…"
                      : "Your restaurant profile is ready."}
              </span>
              <b>{progress}%</b>
            </div>
            <div className="sync-checks">
              {[
                "Restaurant profile & menu",
                "Order channels & demand patterns",
                "Your restaurant’s starting model",
              ].map((s, i) => (
                <div key={s}>
                  {progress >= (i + 1) * 30 ? (
                    <Check size={15} />
                  ) : (
                    <LoaderCircle size={15} className="spin" />
                  )}
                  {s}
                </div>
              ))}
            </div>
            <p className="import-disclosure">
              Your menu, opening hours and order history, together in one place.
            </p>
          </section>
        ) : (
          <>
            <div className="setup-title">
              <div className="eyebrow">MAPLE STREET KITCHEN</div>
              <h1>
                {phase === "details"
                  ? "A few things only you know."
                  : phase === "review"
                    ? "Ready to start?"
                    : "Choose your day."}
              </h1>
              <p>
                {phase === "details"
                  ? "Your order history is ready. Add the behind-the-scenes details that make your restaurant run."
                  : phase === "review"
                    ? "Everything is in place. Take a quick look before continuing."
                    : "Pick a day and choose where the action begins."}
              </p>
            </div>
            {message && (
              <div className="setup-message" role="status">
                {message}
              </div>
            )}
            {phase === "details" ? (
              <>
                <section
                  className={`upload-card drop-zone ${dragging ? "dragging" : ""}`}
                  aria-label="Document drop zone"
                  aria-busy={scanning}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    if (!scanning) setDragging(true);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = scanning ? "none" : "copy";
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    if (
                      !e.currentTarget.contains(e.relatedTarget as Node | null)
                    )
                      setDragging(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    void dropFiles(e.dataTransfer.files);
                  }}
                >
                  <div className="upload-copy">
                    <span className="upload-icon">
                      <Upload size={23} />
                    </span>
                    <div>
                      <h2>Let your documents do the talking.</h2>
                      <p>
                        Drag & drop operating notes, a staff roster, or a cost
                        sheet here, or browse to upload. We’ll look for the
                        missing details.
                      </p>
                      <small>
                        Text-based PDF, DOCX, TXT, CSV, Markdown or JSON · up to
                        8 MB · processed by this local app
                      </small>
                    </div>
                  </div>
                  <div className="button-row">
                    <button
                      className="button primary"
                      disabled={scanning}
                      onClick={() => input.current?.click()}
                    >
                      {scanning ? (
                        <LoaderCircle className="spin" size={16} />
                      ) : (
                        <Upload size={16} />
                      )}
                      {scanning ? "Reading document…" : "Upload a document"}
                    </button>
                    <button className="text-button" onClick={sample}>
                      <Download size={14} />
                      Get sample document
                    </button>
                  </div>
                  <input
                    ref={input}
                    hidden
                    type="file"
                    accept=".pdf,.docx,.txt,.md,.csv,.json"
                    onChange={(e) => void upload(e.target.files?.[0])}
                  />
                  {sources.length > 0 && (
                    <div className="source-list">
                      Read: {sources.join(" · ")}
                    </div>
                  )}
                  {scan && (
                    <div className="scan-summary">
                      <div>
                        <Check size={14} />
                        Found in this file:{" "}
                        {Object.keys(scan.found)
                          .map(
                            (k) =>
                              ({
                                ...fieldNames,
                                vendorItems: "Itemized vendor prices",
                                fixedCosts: "Itemized fixed costs",
                              })[k as keyof Operations],
                          )
                          .join(", ") || "No recognized fields"}
                      </div>
                      {scan.missing.length > 0 && (
                        <p>
                          Not found in this file: {scan.missing.join(", ")}.
                          Existing entries are kept; fill any remaining gaps
                          below or upload another file.
                        </p>
                      )}
                    </div>
                  )}
                </section>
                <ManualLayout
                  seats={seats}
                  stations={stations}
                  onSeats={setSeats}
                  onStations={setStations}
                />
                <div className="setup-details-grid">
                  <aside className="setup-question-nav">
                    {["Inventory & food", "Your team", "Vendors & costs"].map(
                      (s, i) => (
                        <button
                          key={s}
                          className={section === i ? "selected" : ""}
                          onClick={() => setSection(i)}
                        >
                          <span>0{i + 1}</span>
                          {s}
                          {(i === 0
                            ? completed.inventory && completed.foodCost
                            : i === 1
                              ? completed.staff
                              : completed.vendorCost &&
                                completed.otherCost) && <Check size={15} />}
                        </button>
                      ),
                    )}
                    <div className="setup-checklist">
                      <strong>
                        {required.length -
                          missing.length +
                          Number(layoutComplete)}{" "}
                        of {required.length + 1} details ready
                      </strong>
                      <span className={layoutComplete ? "is-complete" : ""}>
                        {layoutComplete ? (
                          <Check size={12} />
                        ) : (
                          <span className="empty-dot" />
                        )}
                        Restaurant layout · entered by you
                      </span>
                      {required.map((k) => (
                        <span
                          key={k}
                          className={completed[k] ? "is-complete" : ""}
                        >
                          {completed[k] ? (
                            <Check size={12} />
                          ) : (
                            <span className="empty-dot" />
                          )}
                          {fieldNames[k]}
                        </span>
                      ))}
                    </div>
                    <button className="text-button" onClick={demo}>
                      Use demo assumptions
                    </button>
                  </aside>
                  <section className="panel question-card">
                    {section === 0 ? (
                      <>
                        <div className="eyebrow">01 / INVENTORY & FOOD</div>
                        <h2>What’s ready in the kitchen?</h2>
                        <p>
                          For this demo, inventory is measured in portions: one
                          portion supplies one order. Food cost is the share of
                          menu value used in ingredients.
                        </p>
                        {numberField(
                          "inventory",
                          "Available portions at opening",
                          "portions",
                          0,
                          10000,
                        )}
                        {numberField(
                          "foodCost",
                          "Ingredient cost as a share of menu price",
                          "%",
                          0,
                          100,
                        )}
                        <div className="field-hint">
                          An empty field means unknown. Enter 0 only when you
                          really mean zero.
                        </div>
                        <button
                          className="button secondary"
                          onClick={() => setSection(1)}
                        >
                          Next: your team
                          <ArrowRight size={14} />
                        </button>
                      </>
                    ) : section === 1 ? (
                      <>
                        <div className="eyebrow">02 / YOUR TEAM</div>
                        <h2>Who’s working, and when?</h2>
                        <p>
                          Add cooks and front-of-house teammates, including
                          their shift times and hourly pay. Times use a 24-hour
                          clock; overnight shifts are outside this demo.
                        </p>
                        <div className="staff-list">
                          {staff.map((person, i) => (
                            <div className="staff-editor" key={i}>
                              <label className="setup-field">
                                <span>Name</span>
                                <input
                                  aria-label={`Staff ${i + 1} name`}
                                  value={person.name}
                                  placeholder="e.g. Alex"
                                  onChange={(e) =>
                                    setStaff((s) =>
                                      s.map((p, j) =>
                                        i === j
                                          ? { ...p, name: e.target.value }
                                          : p,
                                      ),
                                    )
                                  }
                                />
                              </label>
                              <label className="setup-field">
                                <span>Role</span>
                                <select
                                  aria-label={`Staff ${i + 1} role`}
                                  value={person.role}
                                  onChange={(e) =>
                                    setStaff((s) =>
                                      s.map((p, j) =>
                                        i === j
                                          ? {
                                              ...p,
                                              role: e.target
                                                .value as StaffMember["role"],
                                            }
                                          : p,
                                      ),
                                    )
                                  }
                                >
                                  <option value="cook">Cook</option>
                                  <option value="front">Front of house</option>
                                  <option value="back">Backroom</option>
                                </select>
                              </label>
                              {(["start", "end"] as const).map((k) => (
                                <label className="setup-field" key={k}>
                                  <span>
                                    {k === "start" ? "From" : "Until"}
                                  </span>
                                  <input
                                    aria-label={`Staff ${i + 1} ${k}`}
                                    type="time"
                                    onInput={(e) => {
                                      const time = parseTime(
                                        e.currentTarget.value,
                                      );
                                      setStaff((s) =>
                                        s.map((p, j) =>
                                          i === j ? { ...p, [k]: time } : p,
                                        ),
                                      );
                                    }}
                                    value={
                                      Number.isFinite(person[k])
                                        ? timeValue(person[k])
                                        : ""
                                    }
                                    onChange={(e) =>
                                      setStaff((s) =>
                                        s.map((p, j) =>
                                          i === j
                                            ? {
                                                ...p,
                                                [k]: parseTime(e.target.value),
                                              }
                                            : p,
                                        ),
                                      )
                                    }
                                  />
                                </label>
                              ))}
                              <label className="setup-field">
                                <span>$/hour</span>
                                <input
                                  aria-label={`Staff ${i + 1} pay`}
                                  type="number"
                                  min="1"
                                  max="100"
                                  value={person.pay || ""}
                                  onChange={(e) =>
                                    setStaff((s) =>
                                      s.map((p, j) =>
                                        i === j
                                          ? { ...p, pay: +e.target.value }
                                          : p,
                                      ),
                                    )
                                  }
                                />
                              </label>
                              <button
                                className="icon-button"
                                aria-label={`Remove staff member ${i + 1}`}
                                onClick={() =>
                                  setStaff((s) => s.filter((_, j) => i !== j))
                                }
                              >
                                <X size={15} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          className="button secondary"
                          disabled={staff.length >= 24}
                          onClick={() =>
                            setStaff((s) => [
                              ...s,
                              {
                                name: "",
                                role: s.some((p) => p.role === "cook")
                                  ? "front"
                                  : "cook",
                                start: 11,
                                end: 21,
                                pay: 20,
                              },
                            ])
                          }
                        >
                          <Plus size={15} />
                          Add teammate
                        </button>
                        <p className="field-hint">
                          At least one cook and one front-of-house teammate are
                          needed. Cooks prepare orders; front-of-house handles
                          dine-in, pickup and drive-through handoff.
                        </p>
                        <button
                          className="text-button"
                          onClick={() => setSection(2)}
                        >
                          Next: vendors & costs
                          <ArrowRight size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="eyebrow">03 / VENDORS & COSTS</div>
                        <h2>What else does the day cost?</h2>
                        <p>
                          Keep a simple total, or split your suppliers and
                          expenses into individual lines to see what is
                          changing.
                        </p>
                        <label className="toggle-row">
                          <span>
                            <strong>
                              Split vendors & costs into line items
                            </strong>
                            <small>
                              Track suppliers, item quantities and unit prices.
                            </small>
                          </span>
                          <input
                            type="checkbox"
                            checked={itemized}
                            onChange={(e) => {
                              setItemized(e.target.checked);
                              if (
                                e.target.checked &&
                                !fixedCosts.length &&
                                fields.otherCost !== ""
                              )
                                setFixedCosts([
                                  {
                                    id: crypto.randomUUID(),
                                    name: "Other operating costs",
                                    amount: Number(fields.otherCost),
                                  },
                                ]);
                            }}
                          />
                        </label>
                        {itemized ? (
                          <CostEditor
                            vendors={vendors}
                            fixed={fixedCosts}
                            onVendors={setVendors}
                            onFixed={setFixedCosts}
                          />
                        ) : (
                          <>
                            {numberField(
                              "vendorCost",
                              "Vendor and service costs for the day",
                              "$ / day",
                            )}
                            {numberField(
                              "otherCost",
                              "Other fixed operating costs",
                              "$ / day",
                            )}
                            <p className="field-hint">
                              Ingredient costs are already included in the
                              food-cost percentage. Use itemized costs to track
                              a food supplier directly.
                            </p>
                          </>
                        )}
                      </>
                    )}
                  </section>
                </div>
                <ProfileEditor
                  profile={{
                    opening,
                    closing,
                    orders,
                    menu,
                  }}
                  onChange={changeProfile}
                />
                <div className="setup-actions">
                  <span>
                    Missing details? Upload another file or enter them manually.
                  </span>
                  <button
                    className="button primary"
                    disabled={scanning}
                    onClick={continueSetup}
                  >
                    Review my restaurant
                    <ArrowRight size={16} />
                  </button>
                </div>
              </>
            ) : phase === "review" ? (
              <RestaurantReview
                preset={preset}
                opening={opening}
                closing={closing}
                orders={orders}
                seats={seats}
                tables={tables}
                stations={stations}
                menu={menu}
                inventory={fields.inventory}
                staffCount={staff.length}
                onBack={() => {
                  setMessage("");
                  setPhase("details");
                }}
                onContinue={() => {
                  setMessage("");
                  setPhase("schedule");
                }}
              />
            ) : (
              <SchedulePicker
                day={day}
                onDay={setDay}
                opening={opening}
                closing={closing}
                skip={skip}
                onSkip={setSkip}
                start={start}
                onStart={(value) => setStart(parseTime(value))}
                onBack={() => {
                  setMessage("");
                  setPhase("review");
                }}
                onLaunch={launch}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
