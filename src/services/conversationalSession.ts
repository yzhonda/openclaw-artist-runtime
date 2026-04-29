import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ChangeSetProposal } from "./freeformChangesetProposer.js";

export interface ConversationalTurn {
  role: "user" | "artist";
  text: string;
  timestamp: number;
}

export interface ConversationalSession {
  chatId: number;
  userId: number;
  topic: { kind: "persona" | "song" | "free"; songId?: string };
  history: ConversationalTurn[];
  pendingChangeSet?: ChangeSetProposal;
  pendingAction?: { kind: "regenerate_suno" | "publish_arm_switch" | "lyrics_save"; payload: unknown };
  startedAt: number;
  updatedAt: number;
  expiresAt: number;
}

interface SessionStore {
  sessions: ConversationalSession[];
}

export const CONVERSATIONAL_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const historyLimit = 10;

export function conversationalSessionPath(root: string): string {
  return join(root, "runtime", "telegram-conversational-session.json");
}

function sessionKey(chatId: number, userId: number): string {
  return `${chatId}:${userId}`;
}

function normalizeStore(value: unknown): SessionStore {
  const sessions = typeof value === "object" && value !== null && Array.isArray((value as { sessions?: unknown }).sessions)
    ? (value as { sessions: ConversationalSession[] }).sessions
    : [];
  return { sessions };
}

async function readStore(root: string): Promise<SessionStore> {
  const contents = await readFile(conversationalSessionPath(root), "utf8").catch(() => "");
  if (!contents) {
    return { sessions: [] };
  }
  try {
    return normalizeStore(JSON.parse(contents));
  } catch {
    return { sessions: [] };
  }
}

async function writeStore(root: string, store: SessionStore): Promise<void> {
  const path = conversationalSessionPath(root);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

export async function readConversationalSession(root: string, chatId: number, userId: number, now = Date.now()): Promise<ConversationalSession | undefined> {
  const store = await readStore(root);
  return store.sessions.find((session) =>
    sessionKey(session.chatId, session.userId) === sessionKey(chatId, userId) && session.expiresAt > now
  );
}

export async function writeConversationalSession(root: string, session: ConversationalSession): Promise<ConversationalSession> {
  const store = await readStore(root);
  const key = sessionKey(session.chatId, session.userId);
  const sessions = store.sessions.filter((candidate) => sessionKey(candidate.chatId, candidate.userId) !== key);
  sessions.push({ ...session, history: session.history.slice(-historyLimit) });
  await writeStore(root, { sessions });
  return { ...session, history: session.history.slice(-historyLimit) };
}

export async function createConversationalSession(
  root: string,
  input: {
    chatId: number;
    userId: number;
    topic?: ConversationalSession["topic"];
    pendingChangeSet?: ChangeSetProposal;
    pendingAction?: ConversationalSession["pendingAction"];
    now?: number;
    ttlMs?: number;
  }
): Promise<ConversationalSession> {
  const now = input.now ?? Date.now();
  return writeConversationalSession(root, {
    chatId: input.chatId,
    userId: input.userId,
    topic: input.topic ?? { kind: "free" },
    history: [],
    pendingChangeSet: input.pendingChangeSet,
    pendingAction: input.pendingAction,
    startedAt: now,
    updatedAt: now,
    expiresAt: now + (input.ttlMs ?? CONVERSATIONAL_SESSION_TTL_MS)
  });
}

export async function appendConversationTurn(
  root: string,
  input: {
    chatId: number;
    userId: number;
    turn: Omit<ConversationalTurn, "timestamp"> & { timestamp?: number };
    topic?: ConversationalSession["topic"];
    pendingChangeSet?: ChangeSetProposal;
    pendingAction?: ConversationalSession["pendingAction"];
    now?: number;
  }
): Promise<ConversationalSession> {
  const now = input.now ?? Date.now();
  const current = await readConversationalSession(root, input.chatId, input.userId, now)
    ?? await createConversationalSession(root, { chatId: input.chatId, userId: input.userId, topic: input.topic, now });
  return writeConversationalSession(root, {
    ...current,
    topic: input.topic ?? current.topic,
    pendingChangeSet: input.pendingChangeSet ?? current.pendingChangeSet,
    pendingAction: input.pendingAction ?? current.pendingAction,
    history: [...current.history, { ...input.turn, timestamp: input.turn.timestamp ?? now }].slice(-historyLimit),
    updatedAt: now,
    expiresAt: now + CONVERSATIONAL_SESSION_TTL_MS
  });
}

export async function clearConversationalSession(root: string, chatId: number, userId: number): Promise<void> {
  const store = await readStore(root);
  const key = sessionKey(chatId, userId);
  await writeStore(root, {
    sessions: store.sessions.filter((session) => sessionKey(session.chatId, session.userId) !== key)
  });
}
