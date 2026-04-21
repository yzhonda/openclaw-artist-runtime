import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ArtistRuntimeConfig } from "../types.js";
import { updateSongState } from "./artistState.js";
import { appendPromptLedger, createPromptLedgerEntry, getSongPromptLedgerPath } from "./promptLedger.js";

export interface DraftLyricsInput {
  workspaceRoot: string;
  songId: string;
  config?: Partial<ArtistRuntimeConfig>;
}

async function nextLyricsVersion(root: string, songId: string): Promise<number> {
  const entries = await readdir(join(root, "songs", songId, "lyrics"), { withFileTypes: true }).catch(() => []);
  const versions = entries
    .filter((entry) => entry.isFile() && /^lyrics\.v\d+\.md$/.test(entry.name))
    .map((entry) => Number.parseInt(entry.name.replace("lyrics.v", "").replace(".md", ""), 10))
    .filter((value) => Number.isFinite(value));
  return (versions.length > 0 ? Math.max(...versions) : 0) + 1;
}

function deriveLyrics(title: string, brief: string): string {
  const briefLines = brief
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("- "));
  const motif = briefLines[0] ?? "A cold light stays on after midnight.";
  return [
    `${title} waits under the dead neon.`,
    motif,
    "Only the station clock keeps counting the dust.",
    "I leave before the echo learns my name."
  ].join("\n");
}

export async function draftLyrics(input: DraftLyricsInput): Promise<{ lyricsText: string; lyricsPath: string; version: number }> {
  const briefPath = join(input.workspaceRoot, "songs", input.songId, "brief.md");
  const songPath = join(input.workspaceRoot, "songs", input.songId, "song.md");
  const [briefText, songText] = await Promise.all([
    readFile(briefPath, "utf8").catch(() => ""),
    readFile(songPath, "utf8").catch(() => "")
  ]);
  const title = songText.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? input.songId;
  const version = await nextLyricsVersion(input.workspaceRoot, input.songId);
  const lyricsText = deriveLyrics(title, briefText);
  const lyricsPath = join(input.workspaceRoot, "songs", input.songId, "lyrics", `lyrics.v${version}.md`);
  await writeFile(lyricsPath, `${lyricsText}\n`, "utf8");

  await appendPromptLedger(
    getSongPromptLedgerPath(input.workspaceRoot, input.songId),
    createPromptLedgerEntry({
      stage: "lyrics_generation",
      songId: input.songId,
      actor: "artist",
      inputRefs: [briefPath],
      outputRefs: [lyricsPath],
      promptText: briefText,
      outputSummary: lyricsText
    })
  );
  await updateSongState(input.workspaceRoot, input.songId, {
    status: "lyrics",
    reason: "lyrics drafted from brief",
    lyricsVersion: version
  });

  return { lyricsText, lyricsPath, version };
}
