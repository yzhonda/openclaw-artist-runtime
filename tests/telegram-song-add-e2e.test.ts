import { mkdtempSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ensureArtistWorkspace } from "../src/services/artistWorkspace";
import { readSongState } from "../src/services/artistState";
import { routeTelegramCommand } from "../src/services/telegramCommandRouter";
import { readTelegramSongSession } from "../src/services/telegramSongSession";

const baseInput = { fromUserId: 123, chatId: 456 };

function makeRoot(): string {
  return mkdtempSync(join(tmpdir(), "artist-runtime-song-add-"));
}

describe("telegram song add e2e", () => {
  it("runs /song add from rough input through mock AI drafts and creates a song directory", async () => {
    const root = makeRoot();
    await ensureArtistWorkspace(root);

    const start = await routeTelegramCommand({ ...baseInput, text: "/song add", workspaceRoot: root });
    expect(start.responseText).toContain("Song add wizard started");
    await expect(readTelegramSongSession(root)).resolves.toMatchObject({ mode: "song_add_rough" });

    const rough = await routeTelegramCommand({
      ...baseInput,
      text: "社会風刺の低温 hip-hop。配信後のリンクと制作メモを残す。",
      workspaceRoot: root
    });
    expect(rough.responseText).toContain("New song draft 1/5: title");
    await expect(readTelegramSongSession(root)).resolves.toMatchObject({ mode: "song_add_review" });

    await expect(routeTelegramCommand({ ...baseInput, text: "/answer Where It Played Again", workspaceRoot: root })).resolves.toMatchObject({
      responseText: expect.stringContaining("Song edit preview")
    });
    await expect(routeTelegramCommand({ ...baseInput, text: "/confirm", workspaceRoot: root })).resolves.toMatchObject({
      responseText: expect.stringContaining("2/5")
    });
    for (let index = 1; index < 5; index += 1) {
      const response = await routeTelegramCommand({ ...baseInput, text: "/confirm", workspaceRoot: root });
      expect(response.responseText).toMatch(index === 4 ? /All song fields are selected/ : new RegExp(`${index + 2}/5`));
    }
    const written = await routeTelegramCommand({ ...baseInput, text: "/confirm", workspaceRoot: root });
    expect(written.responseText).toContain("Song created: where-it-played-again");

    const state = await readSongState(root, "where-it-played-again");
    const songMd = await readFile(join(root, "songs", "where-it-played-again", "song.md"), "utf8");
    const brief = await readFile(join(root, "songs", "where-it-played-again", "brief.md"), "utf8");
    const lyrics = await readFile(join(root, "songs", "where-it-played-again", "lyrics", "lyrics.v1.md"), "utf8");
    const songbook = await readFile(join(root, "artist", "SONGBOOK.md"), "utf8");
    expect(state.title).toBe("Where It Played Again");
    expect(state.status).toBe("lyrics");
    expect(songMd).toContain("Style Direction");
    expect(brief).toContain("A concise song brief");
    expect(lyrics).toContain("Draft lyrics pending producer review");
    expect(songbook).toContain("| where-it-played-again | Where It Played Again | lyrics |");
    await expect(readTelegramSongSession(root)).resolves.toBeUndefined();
  });
});
