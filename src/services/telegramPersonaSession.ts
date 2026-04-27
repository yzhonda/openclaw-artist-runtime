import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  PersonaField,
  TelegramPersonaSession,
  TelegramPersonaSessionMode
} from "../types.js";

export const TELEGRAM_PERSONA_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export interface CreateTelegramPersonaSessionInput {
  mode: TelegramPersonaSessionMode;
  chatId: number;
  userId: number;
  field?: PersonaField;
  now?: number;
  ttlMs?: number;
}

export interface UpdateTelegramPersonaSessionInput {
  stepIndex?: number;
  field?: PersonaField;
  pending?: TelegramPersonaSession["pending"];
  history?: TelegramPersonaSession["history"];
  active?: boolean;
  now?: number;
  ttlMs?: number;
}

export function telegramPersonaSessionPath(root: string): string {
  return join(root, "runtime", "telegram-persona-session.json");
}

function isPersonaSession(value: Partial<TelegramPersonaSession>): value is TelegramPersonaSession {
  return (
    typeof value.active === "boolean" &&
    typeof value.mode === "string" &&
    typeof value.stepIndex === "number" &&
    typeof value.pending === "object" &&
    Array.isArray(value.history) &&
    typeof value.startedAt === "number" &&
    typeof value.updatedAt === "number" &&
    typeof value.chatId === "number" &&
    typeof value.userId === "number" &&
    typeof value.expiresAt === "number"
  );
}

function isExpired(session: TelegramPersonaSession, now: number): boolean {
  return session.expiresAt <= now;
}

async function writeSession(root: string, session: TelegramPersonaSession): Promise<TelegramPersonaSession> {
  const path = telegramPersonaSessionPath(root);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(session, null, 2)}\n`, "utf8");
  return session;
}

export async function readTelegramPersonaSession(root: string, now = Date.now()): Promise<TelegramPersonaSession | undefined> {
  const contents = await readFile(telegramPersonaSessionPath(root), "utf8").catch(() => "");
  if (!contents) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(contents) as Partial<TelegramPersonaSession>;
    if (!isPersonaSession(parsed) || !parsed.active || isExpired(parsed, now)) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

export async function createTelegramPersonaSession(
  root: string,
  input: CreateTelegramPersonaSessionInput
): Promise<TelegramPersonaSession> {
  const now = input.now ?? Date.now();
  return writeSession(root, {
    active: true,
    mode: input.mode,
    stepIndex: 0,
    field: input.field,
    pending: {},
    history: [],
    startedAt: now,
    updatedAt: now,
    chatId: input.chatId,
    userId: input.userId,
    expiresAt: now + (input.ttlMs ?? TELEGRAM_PERSONA_SESSION_TTL_MS)
  });
}

export async function updateTelegramPersonaSession(
  root: string,
  input: UpdateTelegramPersonaSessionInput
): Promise<TelegramPersonaSession | undefined> {
  const now = input.now ?? Date.now();
  const current = await readTelegramPersonaSession(root, now);
  if (!current) {
    return undefined;
  }
  return writeSession(root, {
    ...current,
    active: input.active ?? current.active,
    stepIndex: input.stepIndex ?? current.stepIndex,
    field: input.field ?? current.field,
    pending: input.pending ?? current.pending,
    history: input.history ?? current.history,
    updatedAt: now,
    expiresAt: now + (input.ttlMs ?? TELEGRAM_PERSONA_SESSION_TTL_MS)
  });
}

export async function cancelTelegramPersonaSession(root: string): Promise<void> {
  await unlink(telegramPersonaSessionPath(root)).catch(() => undefined);
}

export async function handleTelegramPersonaSessionMessage(
  root: string,
  text: string,
  now = Date.now()
): Promise<string | undefined> {
  const session = await readTelegramPersonaSession(root, now);
  if (!session) {
    return undefined;
  }
  const command = text.trim().toLowerCase();
  if (command === "/cancel") {
    await cancelTelegramPersonaSession(root);
    return "Persona setup cancelled. No ARTIST.md or SOUL.md changes were written.";
  }
  if (command === "/back") {
    const previous = session.history[session.history.length - 1];
    await updateTelegramPersonaSession(root, {
      stepIndex: previous?.stepIndex ?? Math.max(session.stepIndex - 1, 0),
      history: session.history.slice(0, -1),
      now
    });
    return "Persona setup moved back one step. The next question will be available in Phase 2.";
  }
  if (command === "/skip") {
    await updateTelegramPersonaSession(root, { stepIndex: session.stepIndex + 1, now });
    return "Skipped this persona setup step. The next question will be available in Phase 2.";
  }
  if (command.startsWith("/confirm")) {
    return "Persona setup confirmation is staged for Phase 2. No files were written.";
  }
  return "Persona setup is in progress. Phase 2 will add the question flow. Send /cancel to stop for now.";
}
