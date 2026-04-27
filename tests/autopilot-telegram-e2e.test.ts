import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ArtistAutopilotService } from "../src/services/autopilotService";
import { getRuntimeEventBus } from "../src/services/runtimeEventBus";
import { TelegramNotifier } from "../src/services/telegramNotifier";

function makeRoot(): string {
  return mkdtempSync(join(tmpdir(), "artist-runtime-autopilot-telegram-"));
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body
  } as Response;
}

describe("autopilot to Telegram notifier e2e", () => {
  it("pushes an autopilot stage transition through RuntimeEventBus to TelegramNotifier with mock fetch", async () => {
    const root = makeRoot();
    const bus = getRuntimeEventBus();
    bus.clearForTest();
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      ok: true,
      result: { message_id: 1 }
    }));
    const unsubscribe = new TelegramNotifier({ token: "mock-token", chatId: 100, fetchImpl }).subscribe(bus);

    try {
      await new ArtistAutopilotService().runCycle({
        workspaceRoot: root,
        config: {
          artist: { workspaceRoot: root },
          autopilot: { enabled: true, dryRun: true },
          music: { suno: { driver: "mock", submitMode: "skip" } },
          telegram: { enabled: false }
        }
      });

      await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());
      const payloads = fetchImpl.mock.calls.map((call) => JSON.parse(call[1].body as string) as { text: string });
      expect(payloads.some((payload) => payload.text.includes("Autopilot stage: idle -> planning"))).toBe(true);
      expect(payloads.every((payload) => payload.text.includes("publish"))).toBe(false);
    } finally {
      unsubscribe();
      bus.clearForTest();
    }
  });
});
