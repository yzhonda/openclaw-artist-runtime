import type { RuntimeEvent, RuntimeEventBus } from "./runtimeEventBus.js";
import { TelegramClient, type TelegramFetch } from "./telegramClient.js";
import { generateArtistResponse, readArtistVoiceContext } from "./artistVoiceResponder.js";
import type { AiReviewProvider } from "../types.js";
import { registerCallbackAction } from "./callbackActionRegistry.js";
import { appendConversationTurn } from "./conversationalSession.js";
import { proposalForDetection } from "./songDistributionPoller.js";

export interface TelegramNotifierOptions {
  token: string;
  chatId: string | number;
  workspaceRoot?: string;
  aiReviewProvider?: AiReviewProvider;
  fetchImpl?: TelegramFetch;
}

export class TelegramNotifier {
  private readonly client: TelegramClient;

  constructor(private readonly options: TelegramNotifierOptions) {
    this.client = new TelegramClient(options.token, options.fetchImpl);
  }

  subscribe(bus: RuntimeEventBus): () => void {
    return bus.subscribe((event) => {
      void this.notify(event);
    });
  }

  async notify(event: RuntimeEvent): Promise<void> {
    const text = await formatRuntimeEvent(event, {
      workspaceRoot: this.options.workspaceRoot,
      aiReviewProvider: this.options.aiReviewProvider
    });
    const sent = await this.client.sendMessage(this.options.chatId, text);
    if (event.type === "song_take_completed") {
      await this.attachSongCompletionButtons(event, sent.message_id).catch(() => undefined);
    }
    if (event.type === "distribution_change_detected") {
      await this.attachDistributionButtons(event, sent.message_id, text).catch(() => undefined);
    }
  }

  private async attachSongCompletionButtons(event: Extract<RuntimeEvent, { type: "song_take_completed" }>, messageId: number): Promise<void> {
    if (!this.options.workspaceRoot || typeof this.options.chatId !== "number") {
      return;
    }
    const [write, skip] = await Promise.all([
      registerCallbackAction(this.options.workspaceRoot, {
        action: "song_songbook_write",
        songId: event.songId,
        chatId: this.options.chatId,
        messageId,
        userId: this.options.chatId
      }),
      registerCallbackAction(this.options.workspaceRoot, {
        action: "song_skip",
        songId: event.songId,
        chatId: this.options.chatId,
        messageId,
        userId: this.options.chatId
      })
    ]);
    await this.client.editMessageReplyMarkup(this.options.chatId, messageId, {
      inline_keyboard: [[
        { text: "📝 SONGBOOK 反映", callback_data: `cb:${write.callbackId}` },
        { text: "⏸ 後で", callback_data: `cb:${skip.callbackId}` }
      ]]
    });
  }

  private async attachDistributionButtons(event: Extract<RuntimeEvent, { type: "distribution_change_detected" }>, messageId: number, text: string): Promise<void> {
    if (!this.options.workspaceRoot || typeof this.options.chatId !== "number") {
      return;
    }
    const proposal = event.proposal ?? proposalForDetection({
      songId: event.songId,
      title: event.songId,
      platform: event.platform,
      url: event.url,
      detectedAt: new Date(event.timestamp).toISOString()
    });
    await appendConversationTurn(this.options.workspaceRoot, {
      chatId: this.options.chatId,
      userId: this.options.chatId,
      topic: { kind: "song", songId: event.songId },
      pendingChangeSet: proposal,
      turn: { role: "artist", text }
    });
    const [apply, skip] = await Promise.all([
      registerCallbackAction(this.options.workspaceRoot, {
        action: "dist_apply",
        proposalId: proposal.id,
        songId: event.songId,
        platform: event.platform,
        chatId: this.options.chatId,
        messageId,
        userId: this.options.chatId
      }),
      registerCallbackAction(this.options.workspaceRoot, {
        action: "dist_skip",
        proposalId: proposal.id,
        songId: event.songId,
        platform: event.platform,
        chatId: this.options.chatId,
        messageId,
        userId: this.options.chatId
      })
    ]);
    await this.client.editMessageReplyMarkup(this.options.chatId, messageId, {
      inline_keyboard: [[
        { text: "✓ 反映する", callback_data: `cb:${apply.callbackId}` },
        { text: "⏸ 後で", callback_data: `cb:${skip.callbackId}` }
      ]]
    });
  }
}

async function artistReport(event: RuntimeEvent, fallback: string, options: Pick<TelegramNotifierOptions, "workspaceRoot" | "aiReviewProvider">): Promise<string> {
  if (!options.workspaceRoot) {
    return fallback;
  }
  const context = await readArtistVoiceContext(options.workspaceRoot, {
    topic: event.type,
    recentHistory: [fallback]
  });
  try {
    const response = await generateArtistResponse(fallback, context, {
      intent: "report",
      aiReviewProvider: options.aiReviewProvider
    });
    return response.text;
  } catch (error) {
    if (error instanceof Error && error.message.includes("secret_like_text")) {
      return fallback;
    }
    throw error;
  }
}

export async function formatRuntimeEvent(
  event: RuntimeEvent,
  options: Pick<TelegramNotifierOptions, "workspaceRoot" | "aiReviewProvider"> = {}
): Promise<string> {
  switch (event.type) {
    case "autopilot_stage_changed":
      return `Autopilot stage: ${event.from ?? "unknown"} -> ${event.to}${event.songId ? ` (${event.songId})` : ""}`;
    case "take_imported":
      return `Take imported: ${event.songId} (${event.paths.length} path(s))`;
    case "autopilot_state_changed":
      return `Autopilot state: enabled=${event.enabled} paused=${event.paused}${event.reason ? ` reason=${event.reason}` : ""}`;
    case "song_take_completed":
      return artistReport(
        event,
        `Song take completed: ${event.songId}${event.selectedTakeId ? ` (${event.selectedTakeId})` : ""}${event.urls.length ? ` ${event.urls.join(" ")}` : ""}`,
        options
      );
    case "theme_generated":
      return artistReport(event, `Theme generated: ${event.theme}. Reason: ${event.reason}`, options);
    case "budget_exhausted":
      return artistReport(event, `Suno budget exhausted: ${event.reason} (${event.used}/${event.limit})`, options);
    case "bird_cooldown_triggered":
      return artistReport(event, `X observation cool-down triggered until ${event.cooldownUntil}: ${event.reason}`, options);
    case "distribution_change_detected":
      return artistReport(
        event,
        `Distribution change detected: ${event.platform} has a public link for ${event.songId}. ${event.url}${event.proposalId ? ` Proposal: ${event.proposalId}` : ""}`,
        options
      );
    case "song_songbook_written":
      return artistReport(event, `SONGBOOK updated: ${event.songId} is now marked published.`, options);
    case "song_publish_skipped":
      return artistReport(event, `Song completion skipped for now: ${event.songId}.`, options);
    case "error":
      return `Runtime error: ${event.source} ${event.reason}${event.songId ? ` (${event.songId})` : ""}`;
  }
}
