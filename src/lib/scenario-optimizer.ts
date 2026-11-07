import { Config, Result, simulate, validateConfig } from "./simulation";
import { resizeStaffGroup } from "./staffing";
export type ScenarioMetrics = Pick<
  Result,
  | "profit"
  | "averageWait"
  | "p90Wait"
  | "happiness"
  | "completed"
  | "lost"
  | "unfinished"
  | "labor"
  | "revenue"
>;
export type ScenarioChoice = { config: Config; result: ScenarioMetrics };
export type OptimizationResult = {
  best: ScenarioChoice;
  fastest: ScenarioChoice;
  tested: number;
  priceSteps: number[];
};
export type SearchOptions = {
  cooks?: readonly number[];
  servers?: readonly number[];
  prices?: readonly number[];
  onProgress?: (done: number, total: number) => void;
};
export function preservePay(baseline: Config, scenario: Config): Config {
  return {
    ...scenario,
    wage: baseline.wage,
    staff: baseline.staff?.map((person) => ({ ...person })),
  };
}
const wait = (choice: ScenarioChoice) =>
  choice.result.completed ? choice.result.averageWait : Infinity;
export function moreProfitable(a: ScenarioChoice, b: ScenarioChoice) {
  const centsA = Math.round(a.result.profit * 100),
    centsB = Math.round(b.result.profit * 100);
  if (centsA !== centsB) return centsA > centsB;
  if (wait(a) !== wait(b)) return wait(a) < wait(b);
  if (a.result.happiness !== b.result.happiness)
    return a.result.happiness > b.result.happiness;
  return a.result.labor < b.result.labor;
}
export function scenarioCandidates(
  config: Config,
  options: SearchOptions = {},
) {
  const unique = (values: readonly number[]) =>
    [...new Set(values)].sort((a, b) => a - b);
  const cooks = unique(
      options.cooks ?? [
        ...Array.from({ length: 12 }, (_, i) => i + 1),
        config.cooks,
      ],
    ),
    servers = unique(
      options.servers ?? [
        ...Array.from({ length: 12 }, (_, i) => i + 1),
        config.servers,
      ],
    ),
    prices = unique(
      options.prices ?? [
        ...Array.from({ length: 11 }, (_, i) => -20 + i * 5),
        config.priceChange,
      ],
    );
  if (!cooks.length || !servers.length || !prices.length)
    throw new Error(
      "The scenario search needs at least one choice for every setting.",
    );
  return {
    configs: cooks.flatMap((cooks) =>
      servers.flatMap((servers) =>
        prices.map((priceChange) => {
          const next = { ...config, cooks, servers, priceChange };
          return config.staffPlan
            ? resizeStaffGroup(
                resizeStaffGroup(next, "cook", cooks),
                "front",
                servers,
              )
            : next;
        }),
      ),
    ),
    prices,
  };
}
const summarize = (config: Config): ScenarioChoice => {
  const r = simulate(config, { includeFrames: false });
  return {
    config,
    result: {
      profit: r.profit,
      averageWait: r.averageWait,
      p90Wait: r.p90Wait,
      happiness: r.happiness,
      completed: r.completed,
      lost: r.lost,
      unfinished: r.unfinished,
      labor: r.labor,
      revenue: r.revenue,
    },
  };
};
export function optimizeScenario(
  config: Config,
  options: SearchOptions = {},
): OptimizationResult {
  validateConfig(config);
  const { configs, prices } = scenarioCandidates(config, options);
  let best = summarize(config),
    fastest = best;
  const minimumFulfilled = best.result.completed;
  options.onProgress?.(0, configs.length);
  for (let i = 0; i < configs.length; i++) {
    const choice = summarize(configs[i]);
    if (moreProfitable(choice, best)) best = choice;
    if (
      choice.result.completed >= minimumFulfilled &&
      choice.result.completed > 0 &&
      (wait(choice) < wait(fastest) ||
        (wait(choice) === wait(fastest) && moreProfitable(choice, fastest)))
    )
      fastest = choice;
    if ((i + 1) % 24 === 0 || i === configs.length - 1)
      options.onProgress?.(i + 1, configs.length);
  }
  return { best, fastest, tested: configs.length, priceSteps: prices };
}
