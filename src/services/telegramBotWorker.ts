import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { AutopilotStatus, TelegramConfig } from "../types.js";
import { getTelegramOwnerUserIds } from "./telegramAuth.js";
import { TelegramClient, type TelegramFetch, type TelegramUpdate } from "./telegramClient.js";
import { classifyTelegramFreeText, routeTelegramCommand, storeTelegramInbox } from "./telegramCommandRouter.js";

export interface TelegramBotWorkerOptions {
  root: string;
  config: TelegramConfig;
  token?: string;
  ownerUserIds?: Set<string>;
  fetchImpl?: TelegramFetch;
  getAutopilotStatus?: () => Promise<AutopilotStatus>;
}

export interface TelegramPollResult {
  enabled: boolean;
  fetched: boolean;
  processed: number;
  nextOffset?: number;
  backoffMs?: number;
  error?: string;
  reason?: "disabled_config" | "missing_token" | "missing_owner_allowlist";
}

interface TelegramWorkerState {
  offset?: number;
}

function statePath(root: string): string {
  return join(root, "runtime", "telegram-state.json");
}

async function readState(root: string): Promise<TelegramWorkerState> {
  const contents = await readFile(statePath(root), "utf8").catch(() => "");
  if (!contents) {
    return {};
  }
  try {
    const parsed = JSON.parse(contents) as Partial<TelegramWorkerState>;
    return Number.isInteger(parsed.offset) ? { offset: parsed.offset } : {};
  } catch {
    return {};
  }
}

async function writeState(root: string, state: TelegramWorkerState): Promise<void> {
  const path = statePath(root);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export class TelegramBotWorker {
  private running = false;
  private timer: NodeJS.Timeout | undefined;
  private backoffMs = 0;
  private readonly token: string | undefined;
  private readonly ownerUserIds: Set<string>;

  constructor(private readonly options: TelegramBotWorkerOptions) {
    this.token = options.token ?? process.env.TELEGRAM_BOT_TOKEN;
    this.ownerUserIds = options.ownerUserIds ?? getTelegramOwnerUserIds();
  }

  async start(): Promise<TelegramPollResult> {
    const disabled = this.disabledReason();
    if (disabled) {
      return { enabled: false, fetched: false, processed: 0, reason: disabled };
    }
    this.running = true;
    const result = await this.pollOnce();
    this.scheduleNext();
    return result;
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  async pollOnce(): Promise<TelegramPollResult> {
    const disabled = this.disabledReason();
    if (disabled) {
      return { enabled: false, fetched: false, processed: 0, reason: disabled };
    }

    try {
      const client = new TelegramClient(this.token ?? "", this.options.fetchImpl);
      const current = await readState(this.options.root);
      const updates = await client.getUpdates(current.offset);
      const nextOffset = this.nextOffset(updates, current.offset);
      let processed = 0;
      for (const update of updates) {
        if (await this.handleUpdate(client, update)) {
          processed += 1;
        }
      }
      if (nextOffset !== undefined) {
        await writeState(this.options.root, { offset: nextOffset });
      }
      this.backoffMs = 0;
      return { enabled: true, fetched: true, processed, nextOffset };
    } catch (error) {
      this.backoffMs = Math.min(Math.max(this.options.config.pollIntervalMs * 2, 1000), 60000);
      return {
        enabled: true,
        fetched: true,
        processed: 0,
        backoffMs: this.backoffMs,
        error: error instanceof Error ? error.message : "telegram_poll_failed"
      };
    }
  }

  private disabledReason(): TelegramPollResult["reason"] | undefined {
    if (!this.options.config.enabled) {
      return "disabled_config";
    }
    if (!this.token?.trim()) {
      return "missing_token";
    }
    if (this.ownerUserIds.size === 0) {
      return "missing_owner_allowlist";
    }
    return undefined;
  }

  private scheduleNext(): void {
    if (!this.running) {
      return;
    }
    const delayMs = this.backoffMs || this.options.config.pollIntervalMs;
    this.timer = setTimeout(() => {
      void this.pollOnce().finally(() => this.scheduleNext());
    }, delayMs);
    this.timer.unref();
  }

  private nextOffset(updates: TelegramUpdate[], currentOffset: number | undefined): number | undefined {
    const maxUpdateId = updates.reduce<number | undefined>(
      (current, update) => (current === undefined || update.update_id > current ? update.update_id : current),
      undefined
    );
    if (maxUpdateId === undefined) {
      return currentOffset;
    }
    return maxUpdateId + 1;
  }

  private async handleUpdate(client: TelegramClient, update: TelegramUpdate): Promise<boolean> {
    const message = update.message;
    const from = message?.from;
    const text = message?.text;
    if (!message || !from || !text || !this.ownerUserIds.has(String(from.id))) {
      return false;
    }

    const route = await routeTelegramCommand({
      text,
      fromUserId: from.id,
      chatId: message.chat.id,
      workspaceRoot: this.options.root,
      autopilotStatus: await this.options.getAutopilotStatus?.()
    });
    if (route.shouldStoreFreeText) {
      await storeTelegramInbox(this.options.root, {
        type: "free_text",
        intent: classifyTelegramFreeText(text),
        fromUserId: from.id,
        chatId: message.chat.id,
        text,
        timestamp: Date.now()
      });
    }
    await client.sendMessage(message.chat.id, route.responseText);
    return true;
  }
}
