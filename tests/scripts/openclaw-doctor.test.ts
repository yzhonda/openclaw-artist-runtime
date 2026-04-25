import { mkdir, writeFile } from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("openclaw-doctor.sh", () => {
  it("reports gateway, X auth, Suno budget, disk, and profile checks as JSON", async () => {
    const root = mkdtempSync(join(tmpdir(), "artist-runtime-doctor-"));
    await mkdir(join(root, "runtime", "suno"), { recursive: true });
    await mkdir(join(root, ".openclaw-browser-profiles", "suno"), { recursive: true });
    await writeFile(
      join(root, "runtime", "config-overrides.json"),
      JSON.stringify({ distribution: { platforms: { x: { authStatus: "tested" } } } }),
      "utf8"
    );
    await writeFile(join(root, "runtime", "suno", "budget.json"), JSON.stringify({ consumed: 10, limit: 60 }), "utf8");
    await writeFile(join(root, ".openclaw-browser-profiles", "suno", "Cookies"), "session", "utf8");
    await writeFile(join(root, "status.json"), '{"ok":true}', "utf8");
    const statusUrl = `file://${join(root, "status.json")}`;

    const result = spawnSync("bash", ["scripts/openclaw-doctor.sh", "--root", root, "--status-url", statusUrl, "--json"], {
      cwd: process.cwd(),
      encoding: "utf8"
    });

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      checks: Array<{ name: string; status: string; detail: string }>;
      summary: { ok: number; warn: number; fail: number };
    };
    expect(parsed.summary.fail).toBe(0);
    expect(parsed.checks.map((check) => check.name)).toEqual([
      "gateway",
      "x_probe",
      "suno_budget",
      "disk_usage",
      "suno_profile"
    ]);
    expect(parsed.checks.every((check) => check.status === "ok")).toBe(true);
  });
});
