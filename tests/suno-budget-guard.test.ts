import { mkdtempSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { reserveSunoGenerationBudget } from "../src/services/sunoBudgetGuard";

describe("suno budget guard", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reserves one daily credit when budget remains", async () => {
    const root = mkdtempSync(join(tmpdir(), "artist-runtime-suno-budget-guard-"));
    vi.stubEnv("OPENCLAW_SUNO_DAILY_BUDGET", "2");

    const result = await reserveSunoGenerationBudget(root, 1, new Date("2026-04-29T00:00:00.000Z"));

    expect(result).toMatchObject({ ok: true, remaining: 1 });
    expect(result.state.used).toBe(1);
  });

  it("does not consume when the daily budget is already exhausted", async () => {
    const root = mkdtempSync(join(tmpdir(), "artist-runtime-suno-budget-low-"));
    await mkdir(join(root, "runtime"), { recursive: true });
    await writeFile(
      join(root, "runtime", "suno-budget-ledger.json"),
      JSON.stringify({ date: "2026-04-29", used: 1, limit: 1, updatedAt: "2026-04-29T00:00:00.000Z" }),
      "utf8"
    );
    vi.stubEnv("OPENCLAW_SUNO_DAILY_BUDGET", "1");

    const result = await reserveSunoGenerationBudget(root, 1, new Date("2026-04-29T01:00:00.000Z"));

    expect(result.ok).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.reason).toContain("budget low");
    expect(result.state.used).toBe(1);
  });
});
