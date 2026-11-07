"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  FlaskConical,
  LoaderCircle,
  Play,
  Sparkles,
} from "lucide-react";
import { Config, laborCost } from "@/lib/simulation";
import {
  OptimizationResult,
  preservePay,
  ScenarioChoice,
} from "@/lib/scenario-optimizer";
import ScenarioTabs from "./scenario-tabs";
const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
const key = (c: Config) => JSON.stringify(c);
export default function ScenarioEditor({
  baseline,
  draft,
  onPatch,
  onRun,
  onApply,
  onReset,
}: {
  baseline: Config;
  draft: Config;
  onPatch: (patch: Partial<Config>) => void;
  onRun: () => void;
  onApply: (c: Config) => void;
  onReset: () => void;
}) {
  const [asking, setAsking] = useState(false),
    [progress, setProgress] = useState(0),
    [solution, setSolution] = useState<OptimizationResult | null>(null),
    [chosen, setChosen] = useState<"best" | "fastest">("best"),
    [error, setError] = useState("");
  const workerRef = useRef<Worker | null>(null),
    appliedKey = useRef("");
  useEffect(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
      setAsking(false);
      setError("The settings changed. Ask Sous again to test the new draft.");
    }
  }, [baseline, draft]);
  useEffect(() => () => workerRef.current?.terminate(), []);
  useEffect(() => setSolution(null), [baseline]);
  const config = preservePay(baseline, draft);
  const apply = (choice: ScenarioChoice, kind: "best" | "fastest") => {
    appliedKey.current = key(choice.config);
    setChosen(kind);
    onApply(choice.config);
  };
  function askSous() {
    workerRef.current?.terminate();
    setAsking(true);
    setProgress(0);
    setError("");
    setSolution(null);
    try {
      const worker = new Worker(
        new URL("../lib/scenario-worker.ts", import.meta.url),
        { type: "module" },
      );
      workerRef.current = worker;
      worker.onmessage = (event: MessageEvent) => {
        if (workerRef.current !== worker) return;
        const message = event.data;
        if (message.type === "progress") {
          setProgress(Math.round((message.done / message.total) * 100));
          return;
        }
        worker.terminate();
        workerRef.current = null;
        setAsking(false);
        if (message.type === "complete") {
          const result = message.result as OptimizationResult;
          setSolution(result);
          apply(result.best, "best");
        } else
          setError(
            message.message ?? "Sous could not finish. Please try again.",
          );
      };
      worker.onerror = () => {
        if (workerRef.current !== worker) return;
        worker.terminate();
        workerRef.current = null;
        setAsking(false);
        setError("Sous could not finish the search. Please try again.");
      };
      worker.postMessage({ config });
    } catch {
      workerRef.current?.terminate();
      workerRef.current = null;
      setAsking(false);
      setError("Sous could not start the search. Please try again.");
    }
  }
  const showSolution = solution && appliedKey.current === key(draft),
    activeChoice = solution?.[chosen];
  const different =
    solution &&
    key(solution.best.config) !== key(solution.fastest.config) &&
    solution.fastest.result.completed > 0;
  return (
    <section className="panel scenario-controls">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">SCENARIO LAB</span>
          <h2>What would you change?</h2>
        </div>
        <FlaskConical size={21} />
      </div>
      <div className="controls-body scenario-editor-body">
        <div className="ask-sous-block">
          <button
            className="button primary full ask-sous-button"
            onClick={askSous}
            disabled={asking}
          >
            {asking ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Sparkles size={16} />
            )}
            <span>
              {asking ? `Testing scenarios… ${progress}%` : "Ask Sous"}
            </span>
            <ArrowRight size={15} />
          </button>
          <p>
            Find the most profitable staffing and menu-price combination.
            Shorter waits break profit ties.
          </p>
          {asking && (
            <div
              className="sous-search-progress"
              role="progressbar"
              aria-label="Sous scenario search"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
        {error && (
          <p className="scenario-error" role="status">
            {error}
          </p>
        )}
        {showSolution && activeChoice && (
          <div className="sous-choice" role="status">
            <div className="sous-choice-heading">
              <Sparkles size={13} />
              {chosen === "best"
                ? "Most profitable scenario applied"
                : "Shortest-wait alternative applied"}
            </div>
            <div className="sous-choice-metrics">
              <span>
                Profit<strong>{money(activeChoice.result.profit)}</strong>
              </span>
              <span>
                Wait
                <strong>
                  {activeChoice.result.completed
                    ? activeChoice.result.averageWait.toFixed(1) + " min"
                    : "No fulfilled orders"}
                </strong>
              </span>
              <span>
                Happiness
                <strong>{activeChoice.result.happiness.toFixed(1)} / 5</strong>
              </span>
            </div>
            <p>
              {solution.tested.toLocaleString()} combinations tested · pay,
              hours, role proportions, backroom staffing, deals and demand
              unchanged. Global prices tested in 5% steps, plus your current
              price.
            </p>
            {different && (
              <button
                className="text-button"
                onClick={() =>
                  apply(
                    chosen === "best" ? solution.fastest : solution.best,
                    chosen === "best" ? "fastest" : "best",
                  )
                }
              >
                {chosen === "best"
                  ? "Prefer the shortest-wait alternative"
                  : "Return to the most profitable option"}
                <ArrowRight size={12} />
              </button>
            )}
            {different && (
              <p>
                The shortest-wait alternative fulfills at least as many orders
                as your starting draft; its profit may be lower.
              </p>
            )}
          </div>
        )}
        <fieldset className="scenario-fields" disabled={asking}>
          <ScenarioTabs
            config={draft}
            onPatch={(patch) => {
              setSolution(null);
              setError("");
              onPatch(patch);
            }}
          />
        </fieldset>
        <p className="muted small fixed-pay-note">
          Labor: {money(laborCost(config))} / shift. Pay rates stay fixed from
          setup; staffing and hours determine labor cost.
        </p>
        <button
          className="button primary full"
          onClick={onRun}
          disabled={asking}
        >
          <Play size={15} />
          Run scenario
        </button>
        <button
          className="text-button full"
          disabled={asking}
          onClick={() => {
            setSolution(null);
            setError("");
            onReset();
          }}
        >
          Reset to baseline
        </button>
      </div>
    </section>
  );
}
