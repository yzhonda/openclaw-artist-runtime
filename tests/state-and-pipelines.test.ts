import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildStatusResponse } from "../src/routes";
import { createSongSkeleton } from "../src/repositories/songRepository";
import { readSongState, updateSongState, writeSongBrief } from "../src/services/artistState";
import { ensureArtistWorkspace } from "../src/services/artistWorkspace";
import { createAndPersistSunoPromptPack } from "../src/services/sunoPromptPackFiles";
import { publishSocialAction } from "../src/services/socialPublishing";
import { generateSunoRun, importSunoResults } from "../src/services/sunoRuns";

describe("artist state", () => {
  it("updates song status without clobbering notes and syncs songbook", async () => {
    const root = mkdtempSync(join(tmpdir(), "artist-runtime-state-"));
    await ensureArtistWorkspace(root);
    await createSongSkeleton(root, "song-001");
    writeFileSync(
      join(root, "songs", "song-001", "song.md"),
      "# Ghost Station\n\n## Notes\n\nKeep the station image.\n",
      "utf8"
    );

    await writeSongBrief(root, "song-001", "# Brief\n\nNight transit residue.");
    await updateSongState(root, "song-001", {
      status: "lyrics",
      title: "Ghost Station",
      reason: "lyrics drafted"
    });

    const state = await readSongState(root, "song-001");
    const songFile = readFileSync(join(root, "songs", "song-001", "song.md"), "utf8");
    const songbook = readFileSync(join(root, "artist", "SONGBOOK.md"), "utf8");

    expect(state.status).toBe("lyrics");
    expect(state.briefPath).toContain("brief.md");
    expect(songFile).toContain("Keep the station image.");
    expect(songbook).toContain("| song-001 | Ghost Station | lyrics |");
  });
});

describe("suno and social pipelines", () => {
  it("records dry-run Suno generate and import into persisted ledgers", async () => {
    const root = mkdtempSync(join(tmpdir(), "artist-runtime-suno-run-"));
    await ensureArtistWorkspace(root);
    await createAndPersistSunoPromptPack({
      workspaceRoot: root,
      songId: "song-001",
      songTitle: "Ghost Station",
      artistReason: "night transit residue",
      lyricsText: "駅の光だけが\nまだ私を覚えている",
      knowledgePackVersion: "test-pack"
    });

    const generated = await generateSunoRun({ workspaceRoot: root, songId: "song-001" });
    const imported = await importSunoResults({
      workspaceRoot: root,
      songId: "song-001",
      runId: generated.runId,
      urls: ["https://example.com/take-1"],
      selectedTakeId: "take-1"
    });

    const runLog = await readFile(join(root, "songs", "song-001", "suno", "runs.jsonl"), "utf8");
    const promptLedger = await readFile(join(root, "songs", "song-001", "prompts", "prompt-ledger.jsonl"), "utf8");
    const state = await readSongState(root, "song-001");

    expect(generated.status).toBe("blocked_dry_run");
    expect(imported.status).toBe("imported");
    expect(runLog).toContain(`"runId":"${generated.runId}"`);
    expect(promptLedger).toContain("\"stage\":\"suno_prepare_to_create\"");
    expect(promptLedger).toContain("\"stage\":\"suno_result_import\"");
    expect(state.status).toBe("takes_imported");
    expect(state.selectedTakeId).toBe("take-1");
  });

  it("records denied social publish and exposes persisted status summaries", async () => {
    const root = mkdtempSync(join(tmpdir(), "artist-runtime-social-"));
    await ensureArtistWorkspace(root);
    await createAndPersistSunoPromptPack({
      workspaceRoot: root,
      songId: "song-001",
      songTitle: "Ghost Station",
      artistReason: "night transit residue",
      lyricsText: "駅の光だけが\nまだ私を覚えている",
      knowledgePackVersion: "test-pack"
    });
    await generateSunoRun({ workspaceRoot: root, songId: "song-001" });

    const social = await publishSocialAction({
      workspaceRoot: root,
      songId: "song-001",
      platform: "x",
      postType: "observation",
      text: "駅の光だけが、まだ私を覚えている。"
    });
    const status = await buildStatusResponse({
      artist: { workspaceRoot: root },
      distribution: {
        platforms: {
          x: { enabled: true }
        }
      }
    });

    const socialLedger = await readFile(join(root, "songs", "song-001", "social", "social-publish.jsonl"), "utf8");
    const auditLog = await readFile(join(root, "songs", "song-001", "audit", "actions.jsonl"), "utf8");

    expect(social.result.accepted).toBe(false);
    expect(social.entry.policyDecision?.policyDecision).toBe("deny_dry_run");
    expect(socialLedger).toContain("\"platform\":\"x\"");
    expect(auditLog).toContain("\"eventType\":\"social_publish\"");
    expect(status.recentSong?.songId).toBe("song-001");
    expect(status.lastSunoRun?.songId).toBe("song-001");
    expect(status.lastSocialAction?.platform).toBe("x");
  });
});
