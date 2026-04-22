import { readFile } from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn()
}));

vi.mock("node:child_process", () => ({
  spawn: spawnMock
}));

import { ArtistAutopilotService, readAutopilotRunState } from "../src/services/autopilotService";
import { ensureArtistWorkspace } from "../src/services/artistWorkspace";
import { readLatestSocialAction } from "../src/services/socialPublishing";
import { readLatestSunoRun, importSunoResults } from "../src/services/sunoRuns";

describe("ArtistAutopilotService full dry-run cycle", () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  it("walks a full dry-run cycle to completed without external side effects", async () => {
    const root = mkdtempSync(join(tmpdir(), "artist-runtime-full-cycle-"));
    await ensureArtistWorkspace(root);

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const service = new ArtistAutopilotService();
    const config = {
      artist: { workspaceRoot: root },
      autopilot: {
        enabled: true,
        dryRun: true
      },
      distribution: {
        enabled: true,
        platforms: {
          x: { enabled: true }
        }
      }
    };

    const first = await service.runCycle({ workspaceRoot: root, config });
    const songId = first.currentSongId ?? "song-001";
    const second = await service.runCycle({ workspaceRoot: root, config });
    const third = await service.runCycle({ workspaceRoot: root, config });

    const generatedRun = await readLatestSunoRun(root, songId);
    expect(generatedRun?.status).toBe("blocked_dry_run");
    await importSunoResults({
      workspaceRoot: root,
      songId,
      runId: generatedRun?.runId ?? "dry-run-import",
      urls: ["https://example.com/takes/auto-1"]
    });

    const fourth = await service.runCycle({ workspaceRoot: root, config });
    const fifth = await service.runCycle({ workspaceRoot: root, config });
    const sixth = await service.runCycle({ workspaceRoot: root, config });
    const seventh = await service.runCycle({ workspaceRoot: root, config });

    const [
      brief,
      lyrics,
      promptPackMetadata,
      runsLedger,
      selectedTake,
      socialAssets,
      socialLedger
    ] = await Promise.all([
      readFile(join(root, "songs", songId, "brief.md"), "utf8"),
      readFile(join(root, "songs", songId, "lyrics", "lyrics.v1.md"), "utf8"),
      readFile(join(root, "songs", songId, "prompts", "prompt-pack-v001", "metadata.json"), "utf8"),
      readFile(join(root, "songs", songId, "suno", "runs.jsonl"), "utf8"),
      readFile(join(root, "songs", songId, "suno", "selected-take.json"), "utf8"),
      readFile(join(root, "songs", songId, "social", "assets.json"), "utf8"),
      readFile(join(root, "songs", songId, "social", "social-publish.jsonl"), "utf8")
    ]);
    const latestSocialAction = await readLatestSocialAction(root, songId);
    const autopilotState = await readAutopilotRunState(root);

    expect([
      first.stage,
      second.stage,
      third.stage,
      fourth.stage,
      fifth.stage,
      sixth.stage,
      seventh.stage
    ]).toEqual([
      "planning",
      "prompt_pack",
      "suno_generation",
      "take_selection",
      "asset_generation",
      "publishing",
      "completed"
    ]);
    expect(second.lastSuccessfulStage).toBe("prompt_pack");
    expect(third.blockedReason).toContain("waiting for Suno result import");
    expect(sixth.blockedReason).toContain("dry-run");
    expect(seventh.lastSuccessfulStage).toBe("completed");

    expect(brief).toContain("Why this song exists");
    expect(lyrics).toContain("dead neon");
    expect(promptPackMetadata).toContain("\"version\": 1");
    expect(runsLedger).toContain("\"status\":\"blocked_dry_run\"");
    expect(runsLedger).toContain("\"status\":\"imported\"");
    expect(selectedTake).toContain("\"selectedTakeId\"");
    expect(socialAssets).toContain("\"platform\": \"x\"");
    expect(socialLedger).toContain("\"action\":\"publish\"");
    expect(socialLedger).toContain("\"dryRun\":true");
    expect(latestSocialAction?.accepted).toBe(false);
    expect(latestSocialAction?.reason).toContain("dry-run");
    expect(autopilotState.stage).toBe("completed");
    expect(autopilotState.currentSongId).toBe(songId);

    expect(spawnMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
