import { mkdtempSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSongSkeleton } from "../src/repositories/songRepository";
import { ensureArtistWorkspace } from "../src/services/artistWorkspace";
import { readSongState, updateSongState } from "../src/services/artistState";
import { routeTelegramCommand } from "../src/services/telegramCommandRouter";
import { readTelegramSongSession } from "../src/services/telegramSongSession";

const baseInput = { fromUserId: 123, chatId: 456 };

function makeRoot(): string {
  return mkdtempSync(join(tmpdir(), "artist-runtime-song-update-"));
}

async function prepareSong(root: string): Promise<void> {
  await ensureArtistWorkspace(root);
  await createSongSkeleton(root, "where-it-played");
  await writeFile(
    join(root, "songs", "where-it-played", "song.md"),
    "# Where It Played\n\n## Notes\n\nKeep the existing ash-road note.\n",
    "utf8"
  );
  await updateSongState(root, "where-it-played", {
    title: "Where It Played",
    status: "scheduled",
    reason: "fixture"
  });
}

async function backupCount(root: string): Promise<number> {
  const artist = await readdir(join(root, "artist"));
  const song = await readdir(join(root, "songs", "where-it-played"));
  return [...artist, ...song].filter((name) => name.includes(".backup-")).length;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("telegram song update e2e", () => {
  it("runs /song update through mock AI drafts and writes song files with one backup per file", async () => {
    const root = makeRoot();
    await prepareSong(root);

    const start = await routeTelegramCommand({ ...baseInput, text: "/song update where-it-played", workspaceRoot: root });
    expect(start.responseText).toContain("Song update wizard started for where-it-played");
    expect(start.responseText).toContain("Song draft 1/6: status");
    await expect(readTelegramSongSession(root)).resolves.toMatchObject({ mode: "song_update_chain" });

    await expect(routeTelegramCommand({ ...baseInput, text: "/answer published", workspaceRoot: root })).resolves.toMatchObject({
      responseText: expect.stringContaining("Song edit preview")
    });
    await expect(routeTelegramCommand({ ...baseInput, text: "/confirm", workspaceRoot: root })).resolves.toMatchObject({
      responseText: expect.stringContaining("2/6")
    });
    for (let index = 1; index < 6; index += 1) {
      const response = await routeTelegramCommand({ ...baseInput, text: "/confirm", workspaceRoot: root });
      expect(response.responseText).toMatch(index === 5 ? /Song update complete/ : new RegExp(`${index + 2}/6`));
    }

    const state = await readSongState(root, "where-it-played");
    const songMd = await readFile(join(root, "songs", "where-it-played", "song.md"), "utf8");
    expect(state.status).toBe("published");
    expect(songMd).toContain("Telegram Update Notes");
    expect(await backupCount(root)).toBe(2);
    await expect(readTelegramSongSession(root)).resolves.toBeUndefined();
  });

  it("disables /song commands when OPENCLAW_SONG_PROPOSER=off", async () => {
    const root = makeRoot();
    await prepareSong(root);
    vi.stubEnv("OPENCLAW_SONG_PROPOSER", "off");

    const response = await routeTelegramCommand({ ...baseInput, text: "/song update where-it-played", workspaceRoot: root });

    expect(response.responseText).toContain("Plan v9.12 song proposer is disabled");
    await expect(readTelegramSongSession(root)).resolves.toBeUndefined();
  });
});
