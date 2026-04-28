import { mkdir, readFile } from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { routeTelegramCommand } from "../src/services/telegramCommandRouter";
import {
  handleTelegramPersonaSessionMessage,
  readTelegramPersonaSession
} from "../src/services/telegramPersonaSession";

const baseInput = {
  fromUserId: 123,
  chatId: 456
};

function makeRoot(): string {
  return mkdtempSync(join(tmpdir(), "artist-runtime-persona-setup-ai-"));
}

async function startSetup(root: string): Promise<void> {
  const start = await routeTelegramCommand({ ...baseInput, text: "/setup", workspaceRoot: root });
  expect(start.responseText).toContain("Artist persona AI setup started");
  await mkdir(join(root, "runtime"), { recursive: true });
}

describe("telegram persona AI setup e2e", () => {
  it("runs rough input through 8 AI draft confirmations and writes ARTIST.md plus SOUL.md", async () => {
    const root = makeRoot();
    await startSetup(root);

    await expect(
      handleTelegramPersonaSessionMessage(root, "和風 hip-hop で社会風刺がメインの男性アーティスト、20代", 1001)
    ).resolves.toContain("Field 1/8");
    for (let index = 0; index < 8; index += 1) {
      const response = await handleTelegramPersonaSessionMessage(root, "/confirm", 1002 + index);
      expect(response).toMatch(index === 7 ? /All AI setup fields/ : new RegExp(`Field ${index + 2}/8`));
    }
    await expect(handleTelegramPersonaSessionMessage(root, "/confirm", 1011)).resolves.toContain("Persona saved");

    const artist = await readFile(join(root, "ARTIST.md"), "utf8");
    const soul = await readFile(join(root, "SOUL.md"), "utf8");
    expect(artist).toContain("Artist name: Unnamed OpenClaw Artist");
    expect(artist).toContain("night infrastructure");
    expect(soul).toContain("Conversation tone: short, direct, observant, and artistically opinionated");
    await expect(readFile(join(root, "runtime", "persona-completed.json"), "utf8")).resolves.toContain("telegram");
    await expect(readTelegramPersonaSession(root, 1012)).resolves.toBeUndefined();
  });

  it("uses two-step skip confirmation for an AI draft field", async () => {
    const root = makeRoot();
    await startSetup(root);
    await handleTelegramPersonaSessionMessage(root, "rough night artist", 1001);

    await expect(handleTelegramPersonaSessionMessage(root, "/skip", 1002)).resolves.toContain("Alternative draft generated");
    await expect(handleTelegramPersonaSessionMessage(root, "/skip", 1003)).resolves.toContain("/confirm skip");
    await expect(handleTelegramPersonaSessionMessage(root, "/confirm skip", 1004)).resolves.toContain("Field 2/8");
  });

  it("rejects secret-like rough input and waits for a safer rewrite", async () => {
    const root = makeRoot();
    await startSetup(root);
    const secretLike = `artist with ${["API", "KEY"].join("_")}=do-not-store`;

    await expect(handleTelegramPersonaSessionMessage(root, secretLike, 1001)).resolves.toContain("Secret-like text detected");
    await expect(readTelegramPersonaSession(root, 1002)).resolves.toMatchObject({ mode: "setup_ai_rough" });
  });

  it("falls back to default drafts after three rough-input skips", async () => {
    const root = makeRoot();
    await startSetup(root);

    await expect(handleTelegramPersonaSessionMessage(root, "/skip", 1001)).resolves.toContain("rough 1-2 sentence");
    await expect(handleTelegramPersonaSessionMessage(root, "/skip", 1002)).resolves.toContain("rough 1-2 sentence");
    await expect(handleTelegramPersonaSessionMessage(root, "/skip", 1003)).resolves.toContain("Using default AI setup drafts");
    await expect(readTelegramPersonaSession(root, 1004)).resolves.toMatchObject({ mode: "setup_ai_review", stepIndex: 0 });
  });
});
