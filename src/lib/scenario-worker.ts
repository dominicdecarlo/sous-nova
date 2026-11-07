/// <reference lib="webworker" />
import { optimizeScenario } from "./scenario-optimizer";
import type { Config } from "./simulation";
const worker = self as unknown as DedicatedWorkerGlobalScope;
worker.onmessage = (event: MessageEvent<{ config: Config }>) => {
  try {
    const result = optimizeScenario(event.data.config, {
      onProgress: (done, total) =>
        worker.postMessage({ type: "progress", done, total }),
    });
    worker.postMessage({ type: "complete", result });
  } catch (error) {
    worker.postMessage({
      type: "error",
      message:
        error instanceof Error
          ? error.message
          : "Sous could not finish the scenario search.",
    });
  }
};
