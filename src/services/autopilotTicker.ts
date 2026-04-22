import { applyConfigDefaults } from "../config/schema.js";
import type { ArtistRuntimeConfig } from "../types.js";
import { ArtistAutopilotService, readAutopilotRunState } from "./autopilotService.js";

type PartialDeep<T> = {
  [K in keyof T]?: T[K] extends string[] ? string[] : T[K] extends Record<string, unknown> ? PartialDeep<T[K]> : T[K];
};

export type AutopilotTickOutcome =
  | "ran"
  | "skipped:disabled"
  | "skipped:paused"
  | "skipped:hardStop"
  | "skipped:concurrent"
  | "error";

export interface AutopilotTickerOptions {
  intervalMs?: number;
  getConfig?: () => PartialDeep<ArtistRuntimeConfig> | undefined;
  onOutcome?: (outcome: AutopilotTickOutcome) => void;
}

const FALLBACK_INTERVAL_MS = 5 * 60 * 1000;

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let running = false;
let singleton: AutopilotTicker | null = null;

export class AutopilotTicker {
  constructor(private readonly options: AutopilotTickerOptions = {}) {}

  start(): void {
    if (intervalHandle) {
      return;
    }
    const intervalMs = this.resolveIntervalMs();
    intervalHandle = setInterval(() => {
      void this.tick();
    }, intervalMs);
  }

  stop(): void {
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
  }

  async tick(configOverride?: PartialDeep<ArtistRuntimeConfig>): Promise<AutopilotTickOutcome> {
    const baseConfig = configOverride ?? this.options.getConfig?.();
    const resolved = applyConfigDefaults(baseConfig);

    if (!resolved.autopilot.enabled) {
      return this.emit("skipped:disabled");
    }

    const state = await readAutopilotRunState(resolved.artist.workspaceRoot);
    if (state.paused) {
      return this.emit("skipped:paused");
    }
    if (state.hardStopReason) {
      return this.emit("skipped:hardStop");
    }
    if (running) {
      return this.emit("skipped:concurrent");
    }

    running = true;
    try {
      await new ArtistAutopilotService().runCycle({
        workspaceRoot: resolved.artist.workspaceRoot,
        config: resolved
      });
      return this.emit("ran");
    } catch {
      return this.emit("error");
    } finally {
      running = false;
    }
  }

  private resolveIntervalMs(): number {
    if (this.options.intervalMs) {
      return this.options.intervalMs;
    }
    const baseConfig = this.options.getConfig?.();
    const resolved = applyConfigDefaults(baseConfig);
    const minutes = resolved.autopilot.cycleIntervalMinutes;
    if (typeof minutes === "number" && minutes > 0) {
      return minutes * 60 * 1000;
    }
    return FALLBACK_INTERVAL_MS;
  }

  private emit(outcome: AutopilotTickOutcome): AutopilotTickOutcome {
    this.options.onOutcome?.(outcome);
    return outcome;
  }
}

export function getAutopilotTicker(options?: AutopilotTickerOptions): AutopilotTicker {
  if (!singleton) {
    singleton = new AutopilotTicker(options);
  }
  return singleton;
}

export function resetAutopilotTickerForTest(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  singleton = null;
  running = false;
}
