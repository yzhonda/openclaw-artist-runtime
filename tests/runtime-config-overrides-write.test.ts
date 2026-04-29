import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readConfigOverrides, readResolvedConfig, writeRuntimeSafetyOverrides } from "../src/services/runtimeConfig";

describe("runtime safety config override writer", () => {
  it("deep-merges whitelisted runtime safety overrides and creates a backup", async () => {
    const root = mkdtempSync(join(tmpdir(), "artist-runtime-runtime-overrides-"));
    const runtimeDir = join(root, "runtime");
    await writeRuntimeSafetyOverrides(root, {
      suno: { dailyBudget: 12 },
      autopilot: { intervalMinutes: 30 }
    });

    await writeRuntimeSafetyOverrides(root, {
      bird: { rateLimits: { dailyMax: 3, minIntervalMinutes: 90 } },
      autopilot: { intervalMinutes: 45 }
    });

    const overrides = await readConfigOverrides(root) as {
      suno?: { dailyBudget?: number };
      bird?: { rateLimits?: { dailyMax?: number; minIntervalMinutes?: number } };
      autopilot?: { intervalMinutes?: number };
    };
    expect(overrides.suno?.dailyBudget).toBe(12);
    expect(overrides.bird?.rateLimits?.dailyMax).toBe(3);
    expect(overrides.bird?.rateLimits?.minIntervalMinutes).toBe(90);
    expect(overrides.autopilot?.intervalMinutes).toBe(45);

    const backups = readdirSync(runtimeDir).filter((name) => /^config-overrides\.\d{8}T\d{6}Z\.bak\.json$/.test(name));
    expect(backups.length).toBeGreaterThanOrEqual(1);
    const backupText = readFileSync(join(runtimeDir, backups[0]!), "utf8");
    expect(backupText).toContain("\"dailyBudget\": 12");

    const resolved = await readResolvedConfig(root);
    expect(resolved.autopilot.cycleIntervalMinutes).toBe(45);
  });

  it("creates config-overrides.json when no override file exists", async () => {
    const root = mkdtempSync(join(tmpdir(), "artist-runtime-runtime-overrides-new-"));

    await writeRuntimeSafetyOverrides(root, { suno: { dailyBudget: 80 } });

    const overrides = await readConfigOverrides(root) as { suno?: { dailyBudget?: number } };
    expect(overrides.suno?.dailyBudget).toBe(80);
    expect(readdirSync(join(root, "runtime")).some((name) => name.endsWith(".bak.json"))).toBe(false);
  });
});
