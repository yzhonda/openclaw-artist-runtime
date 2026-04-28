import { mkdir, readFile, writeFile } from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TelegramConfig } from "../src/types";
import { TelegramBotWorker } from "../src/services/telegramBotWorker";
import { writeSoulPersona } from "../src/services/soulFileBuilder";

const enabledConfig: TelegramConfig = {
  enabled: true,
  pollIntervalMs: 2000,
  notifyStages: true,
  acceptFreeText: true
};

function makeRoot(): string {
  return mkdtempSync(join(tmpdir(), "artist-runtime-persona-check-e2e-"));
}

async function suppressSetupAnnouncement(root: string): Promise<void> {
  await mkdir(join(root, "runtime"), { recursive: true });
  await writeFile(join(root, "runtime", "telegram-state.json"), `${JSON.stringify({ personaSetupAnnouncedAt: 1 }, null, 2)}\n`, "utf8");
}

async function writeImportedPersona(root: string): Promise<void> {
  await writeFile(
    join(root, "ARTIST.md"),
    [
      "# ARTIST.md",
      "",
      "## Public Identity",
      "",
      "Artist name: Obsidian E2E Artist Unit",
      "",
      "A detailed imported identity line from an external notebook.",
      "",
      "## Current Artist Core",
      "",
      "- Core obsessions:",
      "  - neon",
      "- Emotional weather:",
      "  - controlled",
      "",
      "## Sound",
      "",
      "- Cold synth folk, tape hiss, close vocal, station ambience.",
      "",
      "## Lyrics",
      "",
      "- Avoid direct imitation and cheap slogans.",
      "",
      "## Voice",
      "",
      "- Keep this custom section outside managed fields."
    ].join("\n"),
    "utf8"
  );
  await writeSoulPersona(root, {
    conversationTone: "Short, direct, and materially useful.",
    refusalStyle: "Reject weak paths with a reason and one better route."
  });
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body
  } as Response;
}

function makeTelegramFetch(messages: string[]) {
  const sent: string[] = [];
  let index = 0;
  const fetchImpl = vi.fn(async (input: string, init: RequestInit) => {
    if (input.includes("/getUpdates")) {
      const text = messages[index];
      index += 1;
      return jsonResponse({
        ok: true,
        result: text
          ? [
              {
                update_id: index,
                message: {
                  message_id: index,
                  text,
                  chat: { id: 456 },
                  from: { id: 123 }
                }
              }
            ]
          : []
      });
    }
    const payload = JSON.parse(String(init.body)) as { text?: string };
    sent.push(payload.text ?? "");
    return jsonResponse({ ok: true, result: { message_id: sent.length, text: payload.text, chat: { id: 456 } } });
  });
  return { fetchImpl, sent };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("telegram persona check e2e", () => {
  it("does not fetch persona check updates while Telegram is disabled", async () => {
    const fetchImpl = vi.fn();
    const worker = new TelegramBotWorker({
      root: makeRoot(),
      config: { ...enabledConfig, enabled: false },
      token: "test-token",
      ownerUserIds: new Set(["123"]),
      fetchImpl
    });

    const result = await worker.pollOnce();

    expect(result).toMatchObject({ enabled: false, fetched: false, reason: "disabled_config" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("diagnoses, fills a chained field, skips the next field, and returns mock suggestions", async () => {
    vi.stubEnv("OPENCLAW_PERSONA_PROPOSER", "off");
    const root = makeRoot();
    await suppressSetupAnnouncement(root);
    await writeImportedPersona(root);
    const { fetchImpl, sent } = makeTelegramFetch([
      "/persona check",
      "/persona check fill",
      "private signals, broken ads, late trains",
      "/confirm",
      "/skip",
      "/persona check suggest"
    ]);
    const worker = new TelegramBotWorker({
      root,
      config: enabledConfig,
      token: "test-token",
      ownerUserIds: new Set(["123"]),
      fetchImpl,
      aiReviewProvider: "mock"
    });

    for (let index = 0; index < 6; index += 1) {
      await worker.pollOnce();
    }
    worker.stop();

    expect(sent[0]).toContain("obsessions: thin");
    expect(sent[0]).toContain("socialVoice: missing");
    expect(sent[1]).toContain("Starting fill chain");
    expect(sent[2]).toContain("Persona edit preview");
    expect(sent[3]).toContain("Next: socialVoice");
    expect(sent[4]).toContain("All fields complete");
    expect(sent[5]).toContain("Mock provider");
    const artist = await readFile(join(root, "ARTIST.md"), "utf8");
    expect(artist).toContain("private signals");
    expect(artist).toContain("## Voice");
  });
});
