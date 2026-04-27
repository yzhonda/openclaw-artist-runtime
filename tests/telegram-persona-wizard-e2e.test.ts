import { mkdir, readFile } from "node:fs/promises";
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
  return mkdtempSync(join(tmpdir(), "artist-runtime-persona-e2e-"));
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body
  } as Response;
}

describe("telegram persona wizard e2e", () => {
  it("runs setup, SOUL setup, show, edit, and reset-cancel through mock Telegram polling", async () => {
    const root = makeRoot();
    await mkdir(join(root, "runtime"), { recursive: true });
    let nextText = "";
    let updateId = 100;
    const replies: string[] = [];
    const fetchImpl = vi.fn(async (input: string, init: RequestInit) => {
      if (input.includes("/getUpdates")) {
        updateId += 1;
        return jsonResponse({
          ok: true,
          result: [
            {
              update_id: updateId,
              message: {
                message_id: updateId,
                text: nextText,
                chat: { id: 555 },
                from: { id: 123 }
              }
            }
          ]
        });
      }
      if (input.includes("/sendMessage")) {
        const body = JSON.parse(String(init.body)) as { text: string };
        replies.push(body.text);
        return jsonResponse({ ok: true, result: { message_id: updateId, text: body.text, chat: { id: 555 } } });
      }
      throw new Error(`unexpected telegram endpoint: ${input}`);
    });
    const worker = new TelegramBotWorker({
      root,
      config: enabledConfig,
      token: "local-test-token",
      ownerUserIds: new Set(["123"]),
      fetchImpl,
      getAutopilotStatus: async () => ({
        enabled: true,
        dryRun: true,
        stage: "planning",
        nextAction: "decide_next_song"
      })
    });
    const send = async (text: string): Promise<string> => {
      nextText = text;
      const before = replies.length;
      const result = await worker.pollOnce();
      expect(result).toMatchObject({ enabled: true, fetched: true, processed: 1 });
      return replies[before];
    };

    await expect(send("/setup")).resolves.toContain("Artist persona setup started");
    await expect(send("Neon Relay")).resolves.toContain("Q2.");
    await expect(send("A signal-sick night singer built from stations and bad weather.")).resolves.toContain("Q3.");
    await expect(send("ambient pop, glassy synths, close vocal")).resolves.toContain("Q4.");
    await expect(send("stations, broken ads, private signals")).resolves.toContain("Q5.");
    await expect(send("avoid cheap hope, direct imitation, generic slogans")).resolves.toContain("Q6.");
    await expect(send("short, observant, unsalesy")).resolves.toContain("Persona preview");
    await expect(send("/confirm")).resolves.toContain("Persona saved");
    let artist = await readFile(join(root, "ARTIST.md"), "utf8");
    expect(artist).toContain("Artist name: Neon Relay");
    expect(artist).toContain("ambient pop");
    await expect(readFile(join(root, "runtime", "persona-completed.json"), "utf8")).resolves.toContain("telegram");

    await expect(send("/setup soul")).resolves.toContain("SOUL setup started");
    await expect(send("short, direct, lightly poetic")).resolves.toContain("S2.");
    await expect(send("Say no with a reason and one better route.")).resolves.toContain("SOUL preview");
    await expect(send("/confirm")).resolves.toContain("SOUL saved");
    const soul = await readFile(join(root, "SOUL.md"), "utf8");
    expect(soul).toContain("Conversation tone: short, direct, lightly poetic");

    const show = await send("/persona show");
    expect(show).toContain("Artist: Neon Relay");
    expect(show).toContain("Conversation tone: short, direct, lightly poetic");
    expect(show.length).toBeLessThanOrEqual(1600);

    await expect(send("/persona edit sound")).resolves.toContain("Editing sound");
    await expect(send("cold folk, tape hiss, close vocal")).resolves.toContain("Persona edit preview");
    await expect(send("/confirm")).resolves.toContain("Persona field saved");
    artist = await readFile(join(root, "ARTIST.md"), "utf8");
    expect(artist).toContain("cold folk");
    expect(artist).not.toContain("ambient pop, glassy synths, close vocal");

    const beforeResetArtist = artist;
    await expect(send("/persona reset")).resolves.toContain("/confirm reset");
    await expect(send("/cancel")).resolves.toContain("cancelled");
    expect(await readFile(join(root, "ARTIST.md"), "utf8")).toBe(beforeResetArtist);
    expect(fetchImpl.mock.calls.every(([input]) => String(input).startsWith("https://api.telegram.org/"))).toBe(true);
  });
});
