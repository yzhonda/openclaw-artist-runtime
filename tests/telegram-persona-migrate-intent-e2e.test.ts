import { readFile, writeFile } from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { TelegramConfig } from "../src/types";
import { TelegramBotWorker } from "../src/services/telegramBotWorker";

const enabledConfig: TelegramConfig = {
  enabled: true,
  pollIntervalMs: 2000,
  notifyStages: true,
  acceptFreeText: true
};

function makeRoot(): string {
  return mkdtempSync(join(tmpdir(), "artist-runtime-telegram-migrate-intent-"));
}

async function writeImportedPersona(root: string): Promise<void> {
  await writeFile(
    join(root, "ARTIST.md"),
    [
      "# ARTIST.md",
      "",
      "## Public Identity",
      "",
      "Artist name: Telegram Intent Artist",
      "",
      "A notebook identity that should survive migration.",
      "",
      "## Current Artist Core",
      "",
      "- Core obsessions:",
      "  - rain",
      "- Emotional weather:",
      "  - alert",
      "",
      "## Sound",
      "",
      "- Low fidelity station ballads with metal-on-glass rhythm.",
      "",
      "## Lyrics",
      "",
      "- No polished brand slogans.",
      "",
      "## Voice",
      "",
      "- Preserve this custom voice material."
    ].join("\n"),
    "utf8"
  );
  await writeFile(join(root, "SOUL.md"), "# SOUL.md\n\nImported prose with no Telegram Persona Voice section.\n", "utf8");
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

describe("telegram persona migrate intent e2e", () => {
  it("previews operator intent drafts and writes them on confirm", async () => {
    const root = makeRoot();
    await writeImportedPersona(root);
    const { fetchImpl, sent } = makeTelegramFetch([
      "/persona migrate make the social voice spare and unsalesy; use the imported SOUL prose for refusal style",
      "/confirm migrate"
    ]);
    const worker = new TelegramBotWorker({
      root,
      config: enabledConfig,
      token: "test-token",
      ownerUserIds: new Set(["123"]),
      fetchImpl,
      aiReviewProvider: "mock"
    });

    await worker.pollOnce();
    await worker.pollOnce();
    worker.stop();

    expect(sent[0]).toContain("Operator intent:");
    expect(sent[0]).toContain("Proposed drafts (AI provider=mock):");
    expect(sent[0]).toContain("socialVoice:");
    expect(sent[1]).toContain("Persona migrated");
    const artist = await readFile(join(root, "ARTIST.md"), "utf8");
    const soul = await readFile(join(root, "SOUL.md"), "utf8");
    expect(artist).toContain("[mock proposal based on operator intent:");
    expect(soul).toContain("[mock proposal based on operator intent:");
    expect(artist).toContain("## Voice");
    expect(soul).toContain("Imported prose with no Telegram Persona Voice section.");
  });
});
