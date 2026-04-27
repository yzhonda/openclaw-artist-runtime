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
      pending: { name: "Neon Relay" },
      history: [{ stepIndex: 0, field: "name" }],
      now: 2000
    });

    expect(updated).toMatchObject({
      stepIndex: 1,
      pending: { name: "Neon Relay" },
      history: [{ stepIndex: 0, field: "name" }],
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
      history: [{ stepIndex: 0, field: "name", previous: "Old" }],
      now: 1001
    });

    await expect(handleTelegramPersonaSessionMessage(root, "/back", 1002)).resolves.toContain("moved back");
    await expect(readTelegramPersonaSession(root, 1002)).resolves.toMatchObject({ stepIndex: 0 });
    await expect(handleTelegramPersonaSessionMessage(root, "/skip", 1003)).resolves.toContain("Skipped");
    await expect(readTelegramPersonaSession(root, 1003)).resolves.toMatchObject({ stepIndex: 1 });
    await expect(handleTelegramPersonaSessionMessage(root, "/confirm", 1004)).resolves.toContain("Phase 2");
    await expect(handleTelegramPersonaSessionMessage(root, "/cancel", 1005)).resolves.toContain("cancelled");
    await expect(readTelegramPersonaSession(root, 1006)).resolves.toBeUndefined();
    await cancelTelegramPersonaSession(root);
  });
});
