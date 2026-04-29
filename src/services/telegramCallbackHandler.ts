import { appendFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { markCallbackResolved, registerCallbackAction, resolveCallbackAction, type CallbackActionEntry, type CallbackActionStatus } from "./callbackActionRegistry.js";
import { readSongState } from "./artistState.js";
import { applyChangeSet } from "./changeSetApplier.js";
import { handleProposalResponse } from "./conversationalSession.js";
import type { ChangeSetProposal } from "./freeformChangesetProposer.js";
import { secretLikePattern } from "./personaMigrator.js";
import { isArtistPulseEnabled, isXInlineButtonEnabled } from "./runtimeConfig.js";
import { handleSongPublishActionRequest, type SongPublishAction } from "./songPublishActionRegistry.js";
import type { TelegramClient } from "./telegramClient.js";
import { executeXPublishAction, type XPublishActionInput } from "./xPublishActionRegistry.js";

export interface TelegramCallbackContext {
  root: string;
  client: TelegramClient;
  callbackQueryId: string;
  data?: string;
  fromUserId: number;
  chatId?: number;
  messageId?: number;
  now?: number;
  xPublishSpawnImpl?: XPublishActionInput["spawnImpl"];
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
  songId?: string;
  platform?: string;
  chatIdHash?: string;
  userIdHash?: string;
  result: TelegramCallbackResult["result"];
  reason?: string;
  draftHash?: string;
  draftCharCount?: number;
  tweetUrl?: string;
  birdStatus?: string;
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

function auditBase(
  ctx: TelegramCallbackContext,
  callbackId: string | undefined,
  entry: CallbackActionEntry | undefined,
  result: TelegramCallbackResult["result"],
  reason?: string,
  extra: Partial<Pick<CallbackAuditEntry, "draftHash" | "draftCharCount" | "tweetUrl" | "birdStatus">> = {}
): CallbackAuditEntry {
  return {
    timestamp: ctx.now ?? Date.now(),
    callbackId,
    action: entry?.action,
    proposalId: entry?.proposalId,
    songId: entry?.songId,
    platform: entry?.platform,
    chatIdHash: hashIdentifier(ctx.chatId),
    userIdHash: hashIdentifier(ctx.fromUserId),
    result,
    reason,
    ...extra
  };
}

function xPublishSongbookProposal(songId: string, tweetUrl: string, now: number): ChangeSetProposal {
  return {
    id: `x-publish-${songId}-${now.toString(36)}`,
    domain: "song",
    summary: `X post URL recorded for ${songId}.`,
    fields: [
      {
        domain: "song",
        targetFile: join("songs", songId, "song.md"),
        field: "status",
        proposedValue: "published",
        currentValue: "",
        reasoning: "X publish confirmed by producer inline button",
        status: "proposed"
      },
      {
        domain: "song",
        targetFile: join("artist", "SONGBOOK.md"),
        field: "publicLinksOther",
        proposedValue: tweetUrl,
        currentValue: "",
        reasoning: "X publish callback returned a tweet URL",
        status: "proposed"
      }
    ],
    warnings: [],
    createdAt: new Date(now).toISOString(),
    source: "conversation",
    songId,
    platform: "x"
  };
}

function xPreviewText(draftText: string, draftHash: string, draftCharCount: number): string {
  return [
    "X post preview:",
    "",
    draftText,
    "",
    `hash:${draftHash.slice(-8)} chars:${draftCharCount}`,
    "Tap publish only if this exact draft is OK."
  ].join("\n");
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

  if (entry.action === "proposal_yes" || entry.action === "proposal_no" || entry.action === "dist_apply" || entry.action === "dist_skip") {
    await ctx.client.answerCallbackQuery(ctx.callbackQueryId, { text: "OK" });
    const isApply = entry.action === "proposal_yes" || entry.action === "dist_apply";
    const proposalResult = await handleProposalResponse(ctx.root, {
      proposalId: entry.proposalId ?? "",
      action: isApply ? "yes" : "no",
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
    const message = entry.action.startsWith("dist_")
      ? `${proposalResult.status === "applied" ? "Applied ✓" : proposalResult.status === "discarded" ? "Skipped" : "Already resolved"}${entry.platform ? ` ${entry.platform}` : ""}${entry.songId ? ` for ${entry.songId}` : ""}. ${proposalResult.message}`
      : proposalResult.message;
    await ctx.client.editMessageText(entry.chatId, entry.messageId, message, { replyMarkup: { inline_keyboard: [] } }).catch(() => undefined);
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

  if (entry.action === "song_songbook_write" || entry.action === "song_skip") {
    await ctx.client.answerCallbackQuery(ctx.callbackQueryId, { text: "OK" });
    try {
      const actionResult = await handleSongPublishActionRequest({
        action: entry.action as SongPublishAction,
        root: ctx.root,
        songId: entry.songId ?? "",
        now,
        actor: { kind: "telegram_callback", chatId: entry.chatId, userId: entry.userId }
      });
      const callbackStatus: Exclude<CallbackActionStatus, "pending"> = actionResult.status === "applied" ? "applied" : "discarded";
      const callbackResult: TelegramCallbackResult["result"] = actionResult.status === "applied" ? "applied" : "discarded";
      await markCallbackResolved(ctx.root, callbackId, { status: callbackStatus, reason: actionResult.status, now });
      await appendCallbackAudit(ctx.root, auditBase(ctx, callbackId, entry, callbackResult, actionResult.status));
      await ctx.client.editMessageText(entry.chatId, entry.messageId, actionResult.message, { replyMarkup: { inline_keyboard: [] } }).catch(() => undefined);
      return { processed: true, result: callbackResult, reason: actionResult.status, callbackId };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "song_publish_action_failed";
      await markCallbackResolved(ctx.root, callbackId, { status: "failed", reason, now });
      await appendCallbackAudit(ctx.root, auditBase(ctx, callbackId, entry, "failed", reason));
      await ctx.client.editMessageText(entry.chatId, entry.messageId, "Song action failed. Check the runtime log.", { replyMarkup: { inline_keyboard: [] } }).catch(() => undefined);
      return { processed: true, result: "failed", reason, callbackId };
    }
  }

  if (entry.action === "daily_voice_publish" || entry.action === "daily_voice_edit" || entry.action === "daily_voice_cancel") {
    if (!isArtistPulseEnabled()) {
      return finish(ctx, callbackId, entry, "failed", "artist_pulse_disabled", "Artist pulse disabled", "failed");
    }
    await ctx.client.answerCallbackQuery(ctx.callbackQueryId, { text: "OK" });
    if (entry.action === "daily_voice_cancel") {
      await markCallbackResolved(ctx.root, callbackId, { status: "discarded", reason: "daily_voice_cancelled", now });
      await appendCallbackAudit(ctx.root, auditBase(ctx, callbackId, entry, "discarded", "daily_voice_cancelled", {
        draftHash: entry.draftHash,
        draftCharCount: entry.draftCharCount
      }));
      await ctx.client.editMessageText(entry.chatId, entry.messageId, "普段の投稿は取り消した。", { replyMarkup: { inline_keyboard: [] } }).catch(() => undefined);
      return { processed: true, result: "discarded", reason: "daily_voice_cancelled", callbackId };
    }
    if (entry.action === "daily_voice_edit") {
      await markCallbackResolved(ctx.root, callbackId, { status: "updated", reason: "daily_voice_edit_requested", now });
      await appendCallbackAudit(ctx.root, auditBase(ctx, callbackId, entry, "updated", "daily_voice_edit_requested", {
        draftHash: entry.draftHash,
        draftCharCount: entry.draftCharCount
      }));
      await ctx.client.sendMessage(entry.chatId, "直すなら、今の文面を踏まえて普通に返信してくれ。callback に本文は載せない。").catch(() => undefined);
      await ctx.client.editMessageReplyMarkup(entry.chatId, entry.messageId, { inline_keyboard: [] }).catch(() => undefined);
      return { processed: true, result: "updated", reason: "daily_voice_edit_requested", callbackId };
    }
    const published = await executeXPublishAction({
      root: ctx.root,
      songId: "",
      action: "daily_voice_publish",
      entry,
      spawnImpl: ctx.xPublishSpawnImpl
    });
    if (published.status !== "published" || !published.tweetUrl) {
      await markCallbackResolved(ctx.root, callbackId, { status: "failed", reason: published.reason ?? published.status, now });
      await appendCallbackAudit(ctx.root, auditBase(ctx, callbackId, entry, "failed", published.reason ?? published.status, {
        draftHash: entry.draftHash,
        draftCharCount: entry.draftCharCount,
        birdStatus: published.birdStatus
      }));
      await ctx.client.editMessageText(entry.chatId, entry.messageId, `X投稿に失敗: ${published.reason ?? published.status}`, { replyMarkup: { inline_keyboard: [] } }).catch(() => undefined);
      return { processed: true, result: "failed", reason: published.reason ?? published.status, callbackId };
    }
    await markCallbackResolved(ctx.root, callbackId, { status: "applied", reason: "daily_voice_published", now });
    await appendCallbackAudit(ctx.root, auditBase(ctx, callbackId, entry, "applied", "daily_voice_published", {
      draftHash: entry.draftHash,
      draftCharCount: entry.draftCharCount,
      tweetUrl: published.tweetUrl,
      birdStatus: published.birdStatus
    }));
    await ctx.client.editMessageText(entry.chatId, entry.messageId, `X投稿完了。URL: ${published.tweetUrl}`, { replyMarkup: { inline_keyboard: [] } }).catch(() => undefined);
    return { processed: true, result: "applied", reason: "daily_voice_published", callbackId };
  }

  if (entry.action === "x_publish_prepare" || entry.action === "x_publish_confirm" || entry.action === "x_publish_cancel") {
    if (!isXInlineButtonEnabled()) {
      return finish(ctx, callbackId, entry, "failed", "x_inline_button_disabled", "X button disabled", "failed");
    }
    await ctx.client.answerCallbackQuery(ctx.callbackQueryId, { text: "OK" });
    if (entry.action === "x_publish_cancel") {
      const cancelled = await executeXPublishAction({ root: ctx.root, songId: entry.songId ?? "", action: "x_publish_cancel" });
      await markCallbackResolved(ctx.root, callbackId, { status: "discarded", reason: cancelled.status, now });
      await appendCallbackAudit(ctx.root, auditBase(ctx, callbackId, entry, "discarded", cancelled.status));
      await ctx.client.editMessageText(entry.chatId, entry.messageId, "X投稿は取り消した。", { replyMarkup: { inline_keyboard: [] } }).catch(() => undefined);
      return { processed: true, result: "discarded", reason: cancelled.status, callbackId };
    }
    if (entry.action === "x_publish_prepare") {
      const song = await readSongState(ctx.root, entry.songId ?? "");
      const prepared = await executeXPublishAction({
        root: ctx.root,
        songId: entry.songId ?? "",
        action: "x_publish_prepare",
        songState: song,
        sunoUrl: entry.draftUrl
      });
      if (prepared.status !== "prepared" || !prepared.draft) {
        await markCallbackResolved(ctx.root, callbackId, { status: "failed", reason: prepared.reason ?? prepared.status, now });
        await appendCallbackAudit(ctx.root, auditBase(ctx, callbackId, entry, "failed", prepared.reason ?? prepared.status));
        await ctx.client.editMessageText(entry.chatId, entry.messageId, `X投稿準備に失敗: ${prepared.reason ?? prepared.status}`, { replyMarkup: { inline_keyboard: [] } }).catch(() => undefined);
        return { processed: true, result: "failed", reason: prepared.reason ?? prepared.status, callbackId };
      }
      const [confirm, cancel] = await Promise.all([
        registerCallbackAction(ctx.root, {
          action: "x_publish_confirm",
          songId: entry.songId,
          draftText: prepared.draft.draftText,
          draftHash: prepared.draft.draftHash,
          draftCharCount: prepared.draft.draftCharCount,
          draftUrl: prepared.draft.draftUrl,
          chatId: entry.chatId,
          messageId: entry.messageId,
          userId: entry.userId,
          now,
          expiresAt: entry.expiresAt
        }),
        registerCallbackAction(ctx.root, {
          action: "x_publish_cancel",
          songId: entry.songId,
          draftHash: prepared.draft.draftHash,
          draftCharCount: prepared.draft.draftCharCount,
          chatId: entry.chatId,
          messageId: entry.messageId,
          userId: entry.userId,
          now,
          expiresAt: entry.expiresAt
        })
      ]);
      await markCallbackResolved(ctx.root, callbackId, { status: "applied", reason: "prepared", now });
      await appendCallbackAudit(ctx.root, auditBase(ctx, callbackId, entry, "applied", "prepared", {
        draftHash: prepared.draft.draftHash,
        draftCharCount: prepared.draft.draftCharCount
      }));
      await ctx.client.editMessageText(entry.chatId, entry.messageId, xPreviewText(prepared.draft.draftText, prepared.draft.draftHash, prepared.draft.draftCharCount), {
        replyMarkup: { inline_keyboard: [[
          { text: "▶ Xに投稿", callback_data: `cb:${confirm.callbackId}` },
          { text: "⏸ やめる", callback_data: `cb:${cancel.callbackId}` }
        ]] }
      }).catch(() => undefined);
      return { processed: true, result: "applied", reason: "prepared", callbackId };
    }

    const published = await executeXPublishAction({
      root: ctx.root,
      songId: entry.songId ?? "",
      action: "x_publish_confirm",
      entry,
      spawnImpl: ctx.xPublishSpawnImpl
    });
    if (published.status !== "published" || !published.tweetUrl) {
      await markCallbackResolved(ctx.root, callbackId, { status: "failed", reason: published.reason ?? published.status, now });
      await appendCallbackAudit(ctx.root, auditBase(ctx, callbackId, entry, "failed", published.reason ?? published.status, {
        draftHash: entry.draftHash,
        draftCharCount: entry.draftCharCount,
        birdStatus: published.birdStatus
      }));
      await ctx.client.editMessageText(entry.chatId, entry.messageId, `X投稿に失敗: ${published.reason ?? published.status}`, { replyMarkup: { inline_keyboard: [] } }).catch(() => undefined);
      return { processed: true, result: "failed", reason: published.reason ?? published.status, callbackId };
    }
    await applyChangeSet(ctx.root, xPublishSongbookProposal(entry.songId ?? "", published.tweetUrl, now));
    await markCallbackResolved(ctx.root, callbackId, { status: "applied", reason: "published", now });
    await appendCallbackAudit(ctx.root, auditBase(ctx, callbackId, entry, "applied", "published", {
      draftHash: entry.draftHash,
      draftCharCount: entry.draftCharCount,
      tweetUrl: published.tweetUrl,
      birdStatus: published.birdStatus
    }));
    await ctx.client.editMessageText(entry.chatId, entry.messageId, `X投稿完了。URL: ${published.tweetUrl}`, { replyMarkup: { inline_keyboard: [] } }).catch(() => undefined);
    return { processed: true, result: "applied", reason: "published", callbackId };
  }

  await ctx.client.answerCallbackQuery(ctx.callbackQueryId, { text: "Unsupported action" });
  await markCallbackResolved(ctx.root, callbackId, { status: "failed", reason: "unsupported_action", now });
  await appendCallbackAudit(ctx.root, auditBase(ctx, callbackId, entry, "failed", "unsupported_action"));
  await ctx.client.editMessageReplyMarkup(entry.chatId, entry.messageId, { inline_keyboard: [] }).catch(() => undefined);
  return { processed: true, result: "failed", reason: "unsupported_action", callbackId };
}
