import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureArtistWorkspace } from "../src/services/artistWorkspace";
import { readAutopilotRunState, writeAutopilotRunState, ArtistAutopilotService } from "../src/services/autopilotService";
import { readCallbackActionEntries } from "../src/services/callbackActionRegistry";
import { getRuntimeEventBus } from "../src/services/runtimeEventBus";
import { ensureSongState, readSongState, writeSongBrief } from "../src/services/artistState";
import { routeTelegramCallback } from "../src/services/telegramCallbackHandler";
import type { TelegramClient } from "../src/services/telegramClient";
import { TelegramNotifier } from "../src/services/telegramNotifier";

function telegramResponse(result: unknown): Response {
  return new Response(JSON.stringify({ ok: true, result }), { status: 200 });
}

function client(): TelegramClient {
  return {
    answerCallbackQuery: vi.fn().mockResolvedValue(true),
    editMessageReplyMarkup: vi.fn().mockResolvedValue(true),
    editMessageText: vi.fn().mockResolvedValue(true),
    sendMessage: vi.fn().mockResolvedValue({ message_id: 77, chat: { id: 123 } })
  } as unknown as TelegramClient;
}

async function planningWorkspace(): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), "artist-runtime-planning-progression-"));
  await ensureArtistWorkspace(root);
  await ensureSongState(root, "planning-song", "Planning Song");
  await writeSongBrief(root, "planning-song", "# Brief\n\n- Mood: cold");
  await writeAutopilotRunState(root, {
    runId: "run-planning",
    currentSongId: "planning-song",
    stage: "planning",
    paused: false,
    retryCount: 0,
    cycleCount: 0,
    lastRunAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastSuccessfulStage: "planning"
  });
  return root;
}

describe("autopilot planning stage progression", () => {
  afterEach(() => {
    getRuntimeEventBus().clearForTest();
    vi.restoreAllMocks();
  });

  it("auto-completes planning skeletons and advances to prompt_pack when Telegram is off", async () => {
    const root = await planningWorkspace();
    const state = await new ArtistAutopilotService().runCycle({
      workspaceRoot: root,
      config: { autopilot: { enabled: true, dryRun: true }, telegram: { enabled: false } }
    });

    expect(state.stage).toBe("prompt_pack");
    expect(await readSongState(root, "planning-song")).toMatchObject({ status: "suno_prompt_pack" });
  });

  it("pushes an inline completion proposal when Telegram is on and applies it from callback", async () => {
    const root = await planningWorkspace();
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(telegramResponse({ message_id: 88, chat: { id: 123 } }))
      .mockResolvedValueOnce(telegramResponse(true));
    const notifier = new TelegramNotifier({ token: "token", chatId: 123, workspaceRoot: root, aiReviewProvider: "mock", fetchImpl });
    const unsubscribe = notifier.subscribe(getRuntimeEventBus());

    const state = await new ArtistAutopilotService().runCycle({
      workspaceRoot: root,
      config: { autopilot: { enabled: true, dryRun: true }, telegram: { enabled: true } }
    });
    await vi.waitFor(async () => {
      expect((await readCallbackActionEntries(root)).some((entry) => entry.action === "planning_skeleton_apply")).toBe(true);
    });
    unsubscribe();
    const apply = (await readCallbackActionEntries(root)).find((entry) => entry.action === "planning_skeleton_apply");

    expect(state.stage).toBe("planning");
    expect(state.blockedReason).toContain("planning_skeleton_incomplete");
    await expect(routeTelegramCallback({
      root,
      client: client(),
      callbackQueryId: "planning-apply",
      data: `cb:${apply?.callbackId}`,
      fromUserId: 123,
      chatId: 123,
      messageId: 88
    })).resolves.toMatchObject({ result: "applied" });
    expect((await readAutopilotRunState(root)).stage).toBe("prompt_pack");
  });

  it("skips a planning proposal and pauses stale planning states", async () => {
    const root = await planningWorkspace();
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(telegramResponse({ message_id: 90, chat: { id: 123 } }))
      .mockResolvedValueOnce(telegramResponse(true));
    const unsubscribe = new TelegramNotifier({ token: "token", chatId: 123, workspaceRoot: root, aiReviewProvider: "mock", fetchImpl }).subscribe(getRuntimeEventBus());
    const skipped = await new ArtistAutopilotService().runCycle({
      workspaceRoot: root,
      config: { autopilot: { enabled: true, dryRun: true, planningTimeoutDays: 7 }, telegram: { enabled: true } }
    });
    await vi.waitFor(async () => {
      expect((await readCallbackActionEntries(root)).some((entry) => entry.action === "planning_skeleton_skip")).toBe(true);
    });
    unsubscribe();
    const skip = (await readCallbackActionEntries(root)).find((entry) => entry.action === "planning_skeleton_skip");
    await expect(routeTelegramCallback({
      root,
      client: client(),
      callbackQueryId: "planning-skip",
      data: `cb:${skip?.callbackId}`,
      fromUserId: 123,
      chatId: 123,
      messageId: 90
    })).resolves.toMatchObject({ result: "discarded" });
    expect(skipped.stage).toBe("planning");

    await writeAutopilotRunState(root, {
      ...skipped,
      stage: "planning",
      currentSongId: "planning-song",
      lastRunAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z"
    });
    const paused = await new ArtistAutopilotService().runCycle({
      workspaceRoot: root,
      config: { autopilot: { enabled: true, dryRun: true, planningTimeoutDays: 7 }, telegram: { enabled: false } }
    });

    expect(paused).toMatchObject({ stage: "paused", paused: true, pausedReason: "planning_stalled_7days" });
  });
});
