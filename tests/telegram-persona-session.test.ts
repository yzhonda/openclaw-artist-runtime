import { readFile } from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  cancelTelegramPersonaSession,
  createTelegramPersonaSession,
  handleTelegramPersonaSessionMessage,
  readTelegramPersonaSession,
  telegramPersonaSessionPath,
  updateTelegramPersonaSession
} from "../src/services/telegramPersonaSession";

function makeRoot(): string {
  return mkdtempSync(join(tmpdir(), "artist-runtime-persona-session-"));
}

describe("telegram persona session", () => {
  it("creates and reads a setup session with a 24h expiry", async () => {
    const root = makeRoot();
    const session = await createTelegramPersonaSession(root, {
      mode: "setup_artist",
      chatId: 456,
      userId: 123,
      now: 1000
    });

    const read = await readTelegramPersonaSession(root, 1000);

    expect(read).toMatchObject({
      active: true,
      mode: "setup_artist",
      stepIndex: 0,
      chatId: 456,
      userId: 123,
      expiresAt: 1000 + 24 * 60 * 60 * 1000
    });
    expect(JSON.parse(await readFile(telegramPersonaSessionPath(root), "utf8"))).toMatchObject({
      active: session.active,
      mode: session.mode,
      stepIndex: session.stepIndex,
      chatId: session.chatId,
      userId: session.userId
    });
  });

  it("updates step, pending values, history, and extends expiry", async () => {
    const root = makeRoot();
    await createTelegramPersonaSession(root, { mode: "setup_artist", chatId: 456, userId: 123, now: 1000 });

    const updated = await updateTelegramPersonaSession(root, {
      stepIndex: 1,
      pending: { artistName: "Neon Relay" },
      history: [{ stepIndex: 0, field: "artistName" }],
      now: 2000
    });

    expect(updated).toMatchObject({
      stepIndex: 1,
      pending: { artistName: "Neon Relay" },
      history: [{ stepIndex: 0, field: "artistName" }],
      updatedAt: 2000,
      expiresAt: 2000 + 24 * 60 * 60 * 1000
    });
  });

  it("treats expired sessions as absent", async () => {
    const root = makeRoot();
    await createTelegramPersonaSession(root, { mode: "setup_artist", chatId: 456, userId: 123, now: 1000, ttlMs: 10 });

    await expect(readTelegramPersonaSession(root, 1011)).resolves.toBeUndefined();
  });

  it("supports cancel, back, skip, and confirm scaffold responses without writing persona files", async () => {
    const root = makeRoot();
    await createTelegramPersonaSession(root, { mode: "setup_artist", chatId: 456, userId: 123, now: 1000 });
    await updateTelegramPersonaSession(root, {
      stepIndex: 1,
      history: [{ stepIndex: 0, field: "artistName", previous: "Old" }],
      now: 1001
    });

    await expect(handleTelegramPersonaSessionMessage(root, "/back", 1002)).resolves.toContain("Q1. Artist name");
    await expect(readTelegramPersonaSession(root, 1002)).resolves.toMatchObject({ stepIndex: 0 });
    await expect(handleTelegramPersonaSessionMessage(root, "/skip", 1003)).resolves.toContain("Skipped");
    await expect(readTelegramPersonaSession(root, 1003)).resolves.toMatchObject({ stepIndex: 1 });
    await expect(handleTelegramPersonaSessionMessage(root, "/confirm", 1004)).resolves.toContain("not ready");
    await expect(handleTelegramPersonaSessionMessage(root, "/cancel", 1005)).resolves.toContain("cancelled");
    await expect(readTelegramPersonaSession(root, 1006)).resolves.toBeUndefined();
    await cancelTelegramPersonaSession(root);
  });

  it("collects six answers, previews, confirms, writes ARTIST.md, and ends the session", async () => {
    const root = makeRoot();
    await createTelegramPersonaSession(root, { mode: "setup_artist", chatId: 456, userId: 123, now: 1000 });

    await expect(handleTelegramPersonaSessionMessage(root, "Neon Relay", 1001)).resolves.toContain("Q2.");
    await handleTelegramPersonaSessionMessage(
      root,
      "An electronic singer-songwriter built from subway light and failed notifications.",
      1002
    );
    await handleTelegramPersonaSessionMessage(root, "ambient pop, glassy synth, close vocal", 1003);
    await handleTelegramPersonaSessionMessage(root, "stations, broken ads, private signals", 1004);
    await handleTelegramPersonaSessionMessage(root, "avoid cheap hope, direct imitation, generic slogans", 1005);
    await expect(handleTelegramPersonaSessionMessage(root, "short, observant, unsalesy", 1006)).resolves.toContain(
      "Persona preview"
    );
    await expect(handleTelegramPersonaSessionMessage(root, "/confirm", 1007)).resolves.toContain("Persona saved");

    const artist = await readFile(join(root, "ARTIST.md"), "utf8");
    const marker = JSON.parse(await readFile(join(root, "runtime", "persona-completed.json"), "utf8")) as {
      source: string;
      version: number;
    };
    expect(artist).toContain("Artist name: Neon Relay");
    expect(marker).toMatchObject({ source: "telegram", version: 1 });
    await expect(readTelegramPersonaSession(root, 1008)).resolves.toBeUndefined();
  });
});
