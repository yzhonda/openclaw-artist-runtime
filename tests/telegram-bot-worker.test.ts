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
  return mkdtempSync(join(tmpdir(), "artist-runtime-telegram-worker-"));
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body
  } as Response;
}

describe("telegram bot worker", () => {
  it("stays disabled with config off and never fetches", async () => {
    const fetchImpl = vi.fn();
    const worker = new TelegramBotWorker({
      root: makeRoot(),
      config: { ...enabledConfig, enabled: false },
      token: "token",
      ownerUserIds: new Set(["123"]),
      fetchImpl
    });

    const result = await worker.start();

    expect(result).toMatchObject({ enabled: false, fetched: false, reason: "disabled_config" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("stays disabled when the token is missing and never fetches", async () => {
    const fetchImpl = vi.fn();
    const worker = new TelegramBotWorker({
      root: makeRoot(),
      config: enabledConfig,
      token: "",
      ownerUserIds: new Set(["123"]),
      fetchImpl
    });

    const result = await worker.start();

    expect(result).toMatchObject({ enabled: false, fetched: false, reason: "missing_token" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("stays disabled with an empty owner allowlist and never fetches", async () => {
    const fetchImpl = vi.fn();
    const worker = new TelegramBotWorker({
      root: makeRoot(),
      config: enabledConfig,
      token: "token",
      ownerUserIds: new Set(),
      fetchImpl
    });

    const result = await worker.start();

    expect(result).toMatchObject({ enabled: false, fetched: false, reason: "missing_owner_allowlist" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("polls and replies when all opt-in gates are present", async () => {
    const root = makeRoot();
    await mkdir(join(root, "runtime"), { recursive: true });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          result: [
            {
              update_id: 10,
              message: {
                message_id: 1,
                text: "/status",
                chat: { id: 555 },
                from: { id: 123 }
              }
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          result: {
            message_id: 2,
            text: "ok",
            chat: { id: 555 }
          }
        })
      );
    const worker = new TelegramBotWorker({
      root,
      config: enabledConfig,
      token: "token",
      ownerUserIds: new Set(["123"]),
      fetchImpl
    });

    const result = await worker.pollOnce();
    worker.stop();

    expect(result).toMatchObject({ enabled: true, fetched: true, processed: 1, nextOffset: 11 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0][0]).toContain("/getUpdates");
    expect(fetchImpl.mock.calls[1][0]).toContain("/sendMessage");
    const state = JSON.parse(await readFile(join(root, "runtime", "telegram-state.json"), "utf8")) as { offset: number };
    expect(state.offset).toBe(11);
  });

  it("captures long-poll errors without crashing", async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error("network down"));
    const worker = new TelegramBotWorker({
      root: makeRoot(),
      config: enabledConfig,
      token: "token",
      ownerUserIds: new Set(["123"]),
      fetchImpl
    });

    const result = await worker.pollOnce();

    expect(result).toMatchObject({ enabled: true, fetched: true, processed: 0, backoffMs: 4000, error: "network down" });
  });
});
