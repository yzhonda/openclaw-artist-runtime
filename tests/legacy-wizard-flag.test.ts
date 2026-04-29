import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { routeTelegramCommand } from "../src/services/telegramCommandRouter";
import { readTelegramPersonaSession } from "../src/services/telegramPersonaSession";

function workspace(): string {
  return mkdtempSync(join(tmpdir(), "artist-runtime-legacy-wizard-"));
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("legacy wizard flag", () => {
  it("keeps old /persona behavior when OPENCLAW_LEGACY_WIZARD=on", async () => {
    const root = workspace();
    vi.stubEnv("OPENCLAW_LEGACY_WIZARD", "on");

    const result = await routeTelegramCommand({ text: "/persona hello", fromUserId: 1, chatId: 2, workspaceRoot: root });

    expect(result.responseText).toContain("Usage: /persona show");
  });

  it("keeps /setup wizard entry available under the flag", async () => {
    const root = workspace();
    vi.stubEnv("OPENCLAW_LEGACY_WIZARD", "on");

    await routeTelegramCommand({ text: "/setup", fromUserId: 1, chatId: 2, workspaceRoot: root });

    expect((await readTelegramPersonaSession(root))?.mode).toBe("setup_ai_rough");
  });
});
