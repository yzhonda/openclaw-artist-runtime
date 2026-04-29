import { mkdtempSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatRuntimeEvent } from "../src/services/telegramNotifier";

async function workspace(): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), "artist-runtime-telegram-take-push-"));
  await mkdir(join(root, "artist"), { recursive: true });
  await writeFile(join(root, "ARTIST.md"), "Artist name: used::honda\n", "utf8");
  await writeFile(join(root, "SOUL.md"), "Conversation tone: short report\n", "utf8");
  await writeFile(join(root, "artist", "CURRENT_STATE.md"), "still moving\n", "utf8");
  await writeFile(join(root, "artist", "SOCIAL_VOICE.md"), "quiet, sharp\n", "utf8");
  return root;
}

describe("telegram take completed push", () => {
  it("formats take completion through the artist voice responder", async () => {
    const root = await workspace();

    const message = await formatRuntimeEvent({
      type: "song_take_completed",
      songId: "song-001",
      selectedTakeId: "take-1",
      urls: ["https://suno.example/take-1"],
      timestamp: 1
    }, { workspaceRoot: root, aiReviewProvider: "mock" });

    expect(message).toContain("used::honda");
    expect(message).toContain("Song take completed");
    expect(message).toContain("song-001");
  });
});
