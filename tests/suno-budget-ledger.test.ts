import { mkdtempSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { readBudgetState, resetIfNewDay, tryConsumeBudget } from "../src/services/sunoBudgetLedger";

function workspace(): string {
  return mkdtempSync(join(tmpdir(), "artist-runtime-suno-budget-ledger-"));
}

describe("suno budget ledger", () => {
  it("consumes daily budget and blocks over limit", async () => {
    const root = workspace();
    vi.stubEnv("OPENCLAW_SUNO_DAILY_BUDGET", "2");
    const now = new Date("2026-04-29T01:00:00.000Z");

    expect((await tryConsumeBudget(root, 1, now)).ok).toBe(true);
    expect((await tryConsumeBudget(root, 1, now)).ok).toBe(true);
    const blocked = await tryConsumeBudget(root, 1, now);

    expect(blocked.ok).toBe(false);
    expect(blocked.state.used).toBe(2);
    vi.unstubAllEnvs();
  });

  it("resets on JST day boundary", async () => {
    const root = workspace();
    vi.stubEnv("OPENCLAW_SUNO_DAILY_BUDGET", "1");
    await tryConsumeBudget(root, 1, new Date("2026-04-28T14:59:00.000Z"));
    const reset = await resetIfNewDay(root, new Date("2026-04-28T15:00:00.000Z"));

    expect(reset.date).toBe("2026-04-29");
    expect(reset.used).toBe(0);
    vi.unstubAllEnvs();
  });

  it("reads config override daily budget", async () => {
    const root = workspace();
    await mkdir(join(root, "runtime"), { recursive: true });
    await writeFile(join(root, "runtime", "config-overrides.json"), JSON.stringify({ suno: { dailyBudget: 7 } }), "utf8");

    const state = await readBudgetState(root);

    expect(state.limit).toBe(7);
  });
});
