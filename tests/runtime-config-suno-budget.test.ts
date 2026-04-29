import { mkdtempSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveSunoDailyBudget } from "../src/services/runtimeConfig";

function makeRoot(): string {
  return mkdtempSync(join(tmpdir(), "artist-runtime-suno-budget-config-"));
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("runtime config Suno daily budget resolver", () => {
  it("defaults to 50 when no env or override exists", async () => {
    await expect(resolveSunoDailyBudget(makeRoot(), {} as NodeJS.ProcessEnv)).resolves.toBe(50);
  });

  it("uses OPENCLAW_SUNO_DAILY_BUDGET env override first", async () => {
    const root = makeRoot();
    vi.stubEnv("OPENCLAW_SUNO_DAILY_BUDGET", "7");

    await expect(resolveSunoDailyBudget(root)).resolves.toBe(7);
  });

  it("reads runtime/config-overrides.json suno.dailyBudget without schema changes", async () => {
    const root = makeRoot();
    await mkdir(join(root, "runtime"), { recursive: true });
    await writeFile(join(root, "runtime", "config-overrides.json"), JSON.stringify({ suno: { dailyBudget: 12 } }), "utf8");

    await expect(resolveSunoDailyBudget(root, {} as NodeJS.ProcessEnv)).resolves.toBe(12);
  });
});
