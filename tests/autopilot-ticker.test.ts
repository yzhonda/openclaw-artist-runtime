import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AutopilotTicker,
  getAutopilotTicker,
  resetAutopilotTickerForTest,
  type AutopilotTickOutcome
} from "../src/services/autopilotTicker.js";

function makeWorkspace(state: Record<string, unknown>): string {
  const root = mkdtempSync(join(tmpdir(), "autopilot-ticker-"));
  mkdirSync(join(root, "runtime"), { recursive: true });
  writeFileSync(join(root, "runtime", "autopilot-state.json"), JSON.stringify(state), "utf8");
  return root;
}

describe("AutopilotTicker", () => {
  beforeEach(() => {
    resetAutopilotTickerForTest();
  });

  afterEach(() => {
    resetAutopilotTickerForTest();
  });

  it("returns skipped:disabled when autopilot.enabled=false", async () => {
    const outcomes: AutopilotTickOutcome[] = [];
    const ticker = new AutopilotTicker({ onOutcome: (o) => outcomes.push(o) });
    const result = await ticker.tick({ autopilot: { enabled: false } });
    expect(result).toBe("skipped:disabled");
    expect(outcomes).toEqual(["skipped:disabled"]);
  });

  it("returns skipped:paused when state.paused=true", async () => {
    const root = makeWorkspace({ paused: true, stage: "paused" });
    const ticker = new AutopilotTicker();
    const result = await ticker.tick({
      artist: { workspaceRoot: root },
      autopilot: { enabled: true, dryRun: true }
    });
    expect(result).toBe("skipped:paused");
  });

  it("returns skipped:hardStop when hardStopReason is set", async () => {
    const root = makeWorkspace({ paused: false, hardStopReason: "test stop", stage: "failed_closed" });
    const ticker = new AutopilotTicker();
    const result = await ticker.tick({
      artist: { workspaceRoot: root },
      autopilot: { enabled: true, dryRun: true }
    });
    expect(result).toBe("skipped:hardStop");
  });

  it("runs a cycle when enabled and not paused/hardStopped (dry-run)", async () => {
    const root = makeWorkspace({ paused: false, stage: "idle" });
    const ticker = new AutopilotTicker();
    const result = await ticker.tick({
      artist: { workspaceRoot: root },
      autopilot: { enabled: true, dryRun: true }
    });
    expect(result).toBe("ran");
  });

  it("start/stop cleanly manages the interval handle", () => {
    const ticker = new AutopilotTicker({ intervalMs: 100 });
    ticker.start();
    ticker.start();
    ticker.stop();
    ticker.stop();
  });

  it("getAutopilotTicker returns the same singleton instance", () => {
    const a = getAutopilotTicker();
    const b = getAutopilotTicker();
    expect(a).toBe(b);
  });
});
