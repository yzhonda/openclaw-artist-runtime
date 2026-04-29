import { appendFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { markCallbackResolved, resolveCallbackAction, type CallbackActionEntry, type CallbackActionStatus } from "./callbackActionRegistry.js";
import { handleProposalResponse } from "./conversationalSession.js";
import { secretLikePattern } from "./personaMigrator.js";
import type { TelegramClient } from "./telegramClient.js";

export interface TelegramCallbackContext {
  root: string;
  client: TelegramClient;
  callbackQueryId: string;
  data?: string;
  fromUserId: number;
  chatId?: number;
  messageId?: number;
  now?: number;
}

export interface TelegramCallbackResult {
  processed: boolean;
  result: "ignored" | "expired" | "unauthorized" | "duplicate" | "failed" | "applied" | "discarded" | "updated";
  reason?: string;
  callbackId?: string;
}

interface CallbackAuditEntry {
  timestamp: number;
  callbackId?: string;
  action?: string;
  proposalId?: string;
  chatIdHash?: string;
  userIdHash?: string;
  result: TelegramCallbackResult["result"];
  reason?: string;
}

function auditPath(root: string): string {
  return join(root, "runtime", "callback-audit.jsonl");
}

function hashIdentifier(value: number | string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

async function appendCallbackAudit(root: string, entry: CallbackAuditEntry): Promise<void> {
  const path = auditPath(root);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(entry)}\n`, "utf8");
}

function auditBase(ctx: TelegramCallbackContext, callbackId: string | undefined, entry: CallbackActionEntry | undefined, result: TelegramCallbackResult["result"], reason?: string): CallbackAuditEntry {
  return {
    timestamp: ctx.now ?? Date.now(),
    callbackId,
    action: entry?.action,
    proposalId: entry?.proposalId,
    chatIdHash: hashIdentifier(ctx.chatId),
    userIdHash: hashIdentifier(ctx.fromUserId),
    result,
    reason
  };
}

async function finish(
  ctx: TelegramCallbackContext,
  callbackId: string | undefined,
  entry: CallbackActionEntry | undefined,
  result: TelegramCallbackResult["result"],
  reason: string,
  ackText: string,
  status?: Exclude<CallbackActionStatus, "pending">
): Promise<TelegramCallbackResult> {
  await ctx.client.answerCallbackQuery(ctx.callbackQueryId, { text: ackText });
  if (callbackId && status) {
    await markCallbackResolved(ctx.root, callbackId, { status, reason, now: ctx.now });
  }
  await appendCallbackAudit(ctx.root, auditBase(ctx, callbackId, entry, result, reason));
  return { processed: true, result, reason, callbackId };
}

export async function routeTelegramCallback(ctx: TelegramCallbackContext): Promise<TelegramCallbackResult> {
  const data = ctx.data ?? "";
  if (secretLikePattern.test(data)) {
    return finish(ctx, undefined, undefined, "failed", "callback_data_contains_secret_like_text", "Unsupported action", "failed");
  }
  if (!data.startsWith("cb:")) {
    await appendCallbackAudit(ctx.root, auditBase(ctx, undefined, undefined, "ignored", "unsupported_callback_data"));
    return { processed: false, result: "ignored", reason: "unsupported_callback_data" };
  }

  const callbackId = data.slice(3);
  const entry = await resolveCallbackAction(ctx.root, callbackId);
  if (!entry) {
    return finish(ctx, callbackId, undefined, "expired", "callback_action_not_found", "This request expired. Ask me again.", "expired");
  }
  if (ctx.fromUserId !== entry.userId || ctx.chatId !== entry.chatId || ctx.messageId !== entry.messageId) {
    return finish(ctx, callbackId, entry, "unauthorized", "callback_owner_or_message_mismatch", "Not authorized", "unauthorized");
  }
  const now = ctx.now ?? Date.now();
  if (now > entry.expiresAt) {
    return finish(ctx, callbackId, entry, "expired", "callback_action_expired", "Expired", "expired");
  }
  if (entry.status !== "pending") {
    await ctx.client.answerCallbackQuery(ctx.callbackQueryId, { text: "Already resolved" });
    await markCallbackResolved(ctx.root, callbackId, { status: "duplicate", reason: `already_${entry.status}`, now });
    await appendCallbackAudit(ctx.root, auditBase(ctx, callbackId, entry, "duplicate", `already_${entry.status}`));
    return { processed: true, result: "duplicate", reason: `already_${entry.status}`, callbackId };
  }

  if (entry.action === "proposal_yes" || entry.action === "proposal_no") {
    await ctx.client.answerCallbackQuery(ctx.callbackQueryId, { text: "OK" });
    const proposalResult = await handleProposalResponse(ctx.root, {
      proposalId: entry.proposalId ?? "",
      action: entry.action === "proposal_yes" ? "yes" : "no",
      actor: { kind: "telegram_callback", chatId: entry.chatId, userId: entry.userId },
      now
    });
    const callbackStatus: Exclude<CallbackActionStatus, "pending"> =
      proposalResult.status === "applied" ? "applied"
        : proposalResult.status === "discarded" ? "discarded"
          : proposalResult.status === "already_resolved" ? "duplicate"
            : "failed";
    await markCallbackResolved(ctx.root, callbackId, { status: callbackStatus, reason: proposalResult.status, now });
    const callbackResult: TelegramCallbackResult["result"] =
      callbackStatus === "applied" ? "applied"
        : callbackStatus === "discarded" ? "discarded"
          : callbackStatus === "duplicate" ? "duplicate"
            : "failed";
    await appendCallbackAudit(ctx.root, auditBase(ctx, callbackId, entry, callbackResult, proposalResult.status));
    await ctx.client.editMessageText(entry.chatId, entry.messageId, proposalResult.message, { replyMarkup: { inline_keyboard: [] } }).catch(() => undefined);
    return { processed: true, result: callbackResult, reason: proposalResult.status, callbackId };
  }

  if (entry.action === "proposal_edit_open") {
    await ctx.client.answerCallbackQuery(ctx.callbackQueryId, { text: "OK" });
    const proposalResult = await handleProposalResponse(ctx.root, {
      proposalId: entry.proposalId ?? "",
      action: "edit",
      actor: { kind: "telegram_callback", chatId: entry.chatId, userId: entry.userId },
      now
    });
    await markCallbackResolved(ctx.root, callbackId, { status: "updated", reason: "edit_opened", now });
    await appendCallbackAudit(ctx.root, auditBase(ctx, callbackId, entry, "updated", proposalResult.status));
    await ctx.client.sendMessage(entry.chatId, "Edit dialog opened. Send /edit <field> <value>, or use Producer Console to adjust fields.").catch(() => undefined);
    await ctx.client.editMessageReplyMarkup(entry.chatId, entry.messageId, { inline_keyboard: [] }).catch(() => undefined);
    return { processed: true, result: "updated", reason: proposalResult.status, callbackId };
  }

  await ctx.client.answerCallbackQuery(ctx.callbackQueryId, { text: "Unsupported action" });
  await markCallbackResolved(ctx.root, callbackId, { status: "failed", reason: "unsupported_action", now });
  await appendCallbackAudit(ctx.root, auditBase(ctx, callbackId, entry, "failed", "unsupported_action"));
  await ctx.client.editMessageReplyMarkup(entry.chatId, entry.messageId, { inline_keyboard: [] }).catch(() => undefined);
  return { processed: true, result: "failed", reason: "unsupported_action", callbackId };
}
