import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  PersonaAnswers,
  PersonaField,
  TelegramPersonaSession,
  TelegramPersonaSessionMode
} from "../types.js";
import { writeArtistPersona, writePersonaCompletionMarker } from "./personaFileBuilder.js";
import {
  artistPersonaQuestions,
  formatArtistPersonaPreview,
  formatArtistPersonaQuestion,
  getArtistPersonaQuestion,
  isArtistPersonaPreviewStep
} from "./personaWizardQuestions.js";

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
    const stepIndex = isArtistPersonaPreviewStep(session)
      ? Math.max(artistPersonaQuestions.length - 1, 0)
      : previous?.stepIndex ?? Math.max(session.stepIndex - 1, 0);
    await updateTelegramPersonaSession(root, {
      stepIndex,
      history: session.history.slice(0, -1),
      now
    });
    return formatArtistPersonaQuestion(stepIndex);
  }
  if (command === "/skip") {
    return advanceArtistSetup(root, session, undefined, now, true);
  }
  if (command.startsWith("/confirm")) {
    if (!isArtistPersonaPreviewStep(session)) {
      return "Persona setup is not ready to confirm yet. Answer the remaining questions or send /skip.";
    }
    await writeArtistPersona(root, session.pending);
    await writePersonaCompletionMarker(root, new Date(now));
    await cancelTelegramPersonaSession(root);
    return "Persona saved. Use /persona show to review it. To configure SOUL later, send /setup soul.";
  }
  if (command.startsWith("/")) {
    return "Persona setup is active. Send an answer, /skip, /back, /confirm, or /cancel.";
  }
  return advanceArtistSetup(root, session, text, now, false);
}

async function advanceArtistSetup(
  root: string,
  session: TelegramPersonaSession,
  value: string | undefined,
  now: number,
  useDefault: boolean
): Promise<string> {
  if (session.mode !== "setup_artist") {
    return "This persona session mode is reserved for a later phase. Send /cancel to stop it.";
  }
  if (isArtistPersonaPreviewStep(session)) {
    return formatArtistPersonaPreview(session.pending);
  }

  const question = getArtistPersonaQuestion(session.stepIndex);
  if (!question) {
    await updateTelegramPersonaSession(root, { stepIndex: artistPersonaQuestions.length, now });
    return formatArtistPersonaPreview(session.pending);
  }

  const answer = useDefault ? question.defaultValue : value?.trim() ?? "";
  const validationError = useDefault ? undefined : question.validate(answer);
  if (validationError) {
    return validationError;
  }

  const nextPending: Partial<PersonaAnswers> = {
    ...session.pending,
    [question.field]: answer
  };
  const nextStepIndex = session.stepIndex + 1;
  await updateTelegramPersonaSession(root, {
    stepIndex: nextStepIndex,
    pending: nextPending,
    history: [
      ...session.history,
      { stepIndex: session.stepIndex, field: question.field, previous: session.pending[question.field] }
    ],
    now
  });

  const response = nextStepIndex >= artistPersonaQuestions.length
    ? formatArtistPersonaPreview(nextPending)
    : formatArtistPersonaQuestion(nextStepIndex);
  return useDefault ? `Skipped. Default saved for ${question.label}.\n\n${response}` : response;
}
