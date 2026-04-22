import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { patchResolvedConfig, readResolvedConfig } from "../src/services/runtimeConfig.js";

function makeWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), "config-update-"));
  mkdirSync(join(root, "runtime"), { recursive: true });
  return root;
}

describe("config/update behaviour", () => {
  it("patchResolvedConfig persists autopilot.enabled toggle to config-overrides.json", async () => {
    const root = makeWorkspace();

    const updated = await patchResolvedConfig(root, {
      artist: { workspaceRoot: root, mode: "public_artist", artistId: "artist", profilePath: "ARTIST.md" },
      autopilot: { enabled: true, dryRun: true }
    });

    expect(updated.autopilot.enabled).toBe(true);
    expect(updated.autopilot.dryRun).toBe(true);

    const persisted = JSON.parse(readFileSync(join(root, "runtime", "config-overrides.json"), "utf8"));
    expect(persisted.autopilot.enabled).toBe(true);
  });

  it("readResolvedConfig reflects subsequent patch writes", async () => {
    const root = makeWorkspace();

    await patchResolvedConfig(root, {
      artist: { workspaceRoot: root, mode: "public_artist", artistId: "artist", profilePath: "ARTIST.md" },
      autopilot: { enabled: true }
    });

    await patchResolvedConfig(root, {
      artist: { workspaceRoot: root, mode: "public_artist", artistId: "artist", profilePath: "ARTIST.md" },
      autopilot: { songsPerWeek: 5 }
    });

    const resolved = await readResolvedConfig(root);
    expect(resolved.autopilot.enabled).toBe(true);
    expect(resolved.autopilot.songsPerWeek).toBe(5);
  });

  it("empty patch returns current resolved config without error", async () => {
    const root = makeWorkspace();

    await patchResolvedConfig(root, {
      artist: { workspaceRoot: root, mode: "public_artist", artistId: "artist", profilePath: "ARTIST.md" },
      autopilot: { enabled: true }
    });

    const result = await patchResolvedConfig(root, {});
    expect(result.autopilot.enabled).toBe(true);
  });
});
