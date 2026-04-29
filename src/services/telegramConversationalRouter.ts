import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AiReviewProvider, AutopilotStatus } from "../types.js";
import { ArtistAutopilotService } from "./autopilotService.js";
import { readArtistVoiceContext, generateArtistResponse } from "./artistVoiceResponder.js";
import { applyChangeSet } from "./changeSetApplier.js";
import {
  appendConversationTurn,
  clearConversationalSession,
  createConversationalSession,
  readConversationalSession,
  writeConversationalSession,
  type ConversationalSession
} from "./conversationalSession.js";
import { proposeFreeformChangeSet, type ChangeSetProposal } from "./freeformChangesetProposer.js";
import { secretLikePattern } from "./personaMigrator.js";

export interface TelegramConversationalRouteInput {
  text: string;
  fromUserId: number;
  chatId: number;
  workspaceRoot: string;
  aiReviewProvider?: AiReviewProvider;
  autopilotStatus?: AutopilotStatus;
}

export interface TelegramConversationalRouteResult {
  responseText: string;
  shouldStoreFreeText: boolean;
}

function stripCommand(text: string): string {
  return text.replace(/^\/(persona|song|talk)\b/i, "").trim();
}

function songCreateHint(text: string): string | undefined {
  const slash = text.match(/^\/song\s+create(?:\s+([\s\S]*))?$/i);
  if (slash) {
    return slash[1]?.trim() || undefined;
  }
  const natural = text.match(/(?:曲作って|新曲|make a song|produce|create song|作品作って)\s*([\s\S]*)/i);
  return natural ? natural[1]?.trim() || undefined : undefined;
}

function isSongCreate(text: string): boolean {
  return /^\/song\s+create\b/i.test(text) || /曲作って|新曲|make a song|produce|create song|作品作って/i.test(text);
}

function affirmative(text: string): boolean {
  return /^\/?(yes|y|ok|confirm|one|はい|お願い|やって)\b/i.test(text);
}

function negative(text: string): boolean {
  return /^\/?(no|n|cancel|やめ|不要|違う)\b/i.test(text);
}

function formatChangeSet(proposal: ChangeSetProposal): string {
  return [
    proposal.summary,
    ...proposal.fields.slice(0, 8).map((field) => `- ${field.field}: ${field.proposedValue}`),
    "反映するなら /yes、やめるなら /no。直すなら /edit <field> <value>。"
  ].join("\n");
}

async function proposeFromConversation(root: string, text: string, session: ConversationalSession, provider?: AiReviewProvider): Promise<ChangeSetProposal | undefined> {
  if (!/(変え|変更|直し|update|edit|persona|歌詞|lyrics|曲|song)/i.test(text)) {
    return undefined;
  }
  const domain = session.topic.kind === "song" ? "song" : "persona";
  const [artistMd, soulMd, songMd, briefMd, songbookEntry, currentState] = await Promise.all([
    readFile(join(root, "ARTIST.md"), "utf8").catch(() => ""),
    readFile(join(root, "SOUL.md"), "utf8").catch(() => ""),
    session.topic.songId ? readFile(join(root, "songs", session.topic.songId, "song.md"), "utf8").catch(() => "") : Promise.resolve(""),
    session.topic.songId ? readFile(join(root, "songs", session.topic.songId, "brief.md"), "utf8").catch(() => "") : Promise.resolve(""),
    readFile(join(root, "artist", "SONGBOOK.md"), "utf8").catch(() => ""),
    readFile(join(root, "artist", "CURRENT_STATE.md"), "utf8").catch(() => "")
  ]);
  return proposeFreeformChangeSet({
    domain,
    root,
    userMessage: text,
    aiReviewProvider: provider,
    songId: session.topic.songId,
    artistMd,
    soulMd,
    songMd,
    briefMd,
    songbookEntry,
    currentState
  });
}

async function respondAsArtist(root: string, text: string, session: ConversationalSession, provider?: AiReviewProvider): Promise<string> {
  const context = await readArtistVoiceContext(root, {
    topic: session.topic.kind,
    recentHistory: session.history.map((turn) => `${turn.role}: ${turn.text}`)
  });
  return (await generateArtistResponse(text, context, { intent: "discuss", aiReviewProvider: provider })).text;
}

export async function routeTelegramConversation(input: TelegramConversationalRouteInput): Promise<TelegramConversationalRouteResult> {
  const text = input.text.trim();
  if (secretLikePattern.test(text)) {
    return { responseText: "それ、秘密っぽい文字列が混じってる。別の言い方で投げてくれ。", shouldStoreFreeText: true };
  }
  const existing = await readConversationalSession(input.workspaceRoot, input.chatId, input.fromUserId);
  const topic = text.startsWith("/song")
    ? { kind: "song" as const, songId: text.match(/^\/song\s+([^\s]+)/i)?.[1] === "create" ? undefined : text.match(/^\/song\s+([^\s]+)/i)?.[1] }
    : text.startsWith("/persona")
      ? { kind: "persona" as const }
      : existing?.topic ?? { kind: "free" as const };
  let session = existing ?? await createConversationalSession(input.workspaceRoot, {
    chatId: input.chatId,
    userId: input.fromUserId,
    topic
  });
  session = { ...session, topic };

  if (isSongCreate(text)) {
    const hint = songCreateHint(text);
    void new ArtistAutopilotService().runCycle({
      workspaceRoot: input.workspaceRoot,
      manualSeed: { hint: hint ?? "" }
    }).catch(() => undefined);
    const response = hint ? `その話題、見に行く。${hint} を芯にして曲にする。結果を待っててくれ。` : "観察してくる。こっちで曲に起こす、結果を待っててくれ。";
    await appendConversationTurn(input.workspaceRoot, { chatId: input.chatId, userId: input.fromUserId, topic, turn: { role: "artist", text: response } });
    return { responseText: response, shouldStoreFreeText: true };
  }

  if (session.pendingChangeSet && affirmative(text)) {
    const result = await applyChangeSet(input.workspaceRoot, session.pendingChangeSet);
    await clearConversationalSession(input.workspaceRoot, input.chatId, input.fromUserId);
    return {
      responseText: `反映した。applied=${result.applied.length}, skipped=${result.skipped.length}${result.warnings.length ? `\nWarnings: ${result.warnings.join("; ")}` : ""}`,
      shouldStoreFreeText: false
    };
  }
  if (session.pendingChangeSet && negative(text)) {
    await writeConversationalSession(input.workspaceRoot, { ...session, pendingChangeSet: undefined, updatedAt: Date.now() });
    return { responseText: "やめておく。話は続けられる。", shouldStoreFreeText: false };
  }
  const edit = text.match(/^\/edit\s+(\S+)\s+([\s\S]+)$/i);
  if (session.pendingChangeSet && edit) {
    const [, field, value] = edit;
    const fields = session.pendingChangeSet.fields.map((candidate) => candidate.field === field ? { ...candidate, proposedValue: value } : candidate);
    const proposal = { ...session.pendingChangeSet, fields };
    await writeConversationalSession(input.workspaceRoot, { ...session, pendingChangeSet: proposal, updatedAt: Date.now() });
    return { responseText: formatChangeSet(proposal), shouldStoreFreeText: false };
  }

  const cleanText = stripCommand(text) || text;
  await appendConversationTurn(input.workspaceRoot, { chatId: input.chatId, userId: input.fromUserId, topic, turn: { role: "user", text: cleanText } });
  session = await readConversationalSession(input.workspaceRoot, input.chatId, input.fromUserId) ?? session;
  const proposal = await proposeFromConversation(input.workspaceRoot, cleanText, session, input.aiReviewProvider);
  const artistText = await respondAsArtist(input.workspaceRoot, cleanText, session, input.aiReviewProvider);
  if (proposal && proposal.fields.length > 0) {
    const next = await appendConversationTurn(input.workspaceRoot, {
      chatId: input.chatId,
      userId: input.fromUserId,
      topic,
      pendingChangeSet: proposal,
      turn: { role: "artist", text: artistText }
    });
    await writeConversationalSession(input.workspaceRoot, next);
    return { responseText: `${artistText}\n\n${formatChangeSet(proposal)}`, shouldStoreFreeText: true };
  }
  await appendConversationTurn(input.workspaceRoot, { chatId: input.chatId, userId: input.fromUserId, topic, turn: { role: "artist", text: artistText } });
  return { responseText: artistText, shouldStoreFreeText: true };
}

export function isConversationalSongCreate(text: string): boolean {
  return isSongCreate(text);
}
