import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  AiReviewProvider,
  PersonaAnswers,
  PersonaField,
  TelegramPersonaSession,
  TelegramPersonaSessionMode
} from "../types.js";
import {
  resetArtistPersonaBlock,
  updateArtistPersonaField,
  writeArtistPersona,
  writePersonaCompletionMarker,
  type ArtistPersonaSummary
} from "./personaFileBuilder.js";
import {
  artistPersonaQuestions,
  formatArtistPersonaPreview,
  formatArtistPersonaQuestion,
  getArtistPersonaQuestion,
  isArtistPersonaPreviewStep
} from "./personaWizardQuestions.js";
import { executePersonaMigrate, planPersonaMigrate } from "./personaMigrator.js";
import {
  formatSoulPersonaPreview,
  formatSoulPersonaQuestion,
  resetSoulPersonaBlock,
  soulPersonaQuestions,
  updateSoulPersonaField,
  writeSoulPersona,
  type SoulPersonaSummary
} from "./soulFileBuilder.js";

export const TELEGRAM_PERSONA_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export interface CreateTelegramPersonaSessionInput {
  mode: TelegramPersonaSessionMode;
  chatId: number;
  userId: number;
  field?: PersonaField;
  checkFillQueue?: PersonaField[];
  migrateIntent?: string;
  migrateAiReviewProvider?: AiReviewProvider;
  now?: number;
  ttlMs?: number;
}

export interface UpdateTelegramPersonaSessionInput {
  stepIndex?: number;
  field?: PersonaField;
  checkFillQueue?: PersonaField[];
  migrateIntent?: string;
  migrateAiReviewProvider?: AiReviewProvider;
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
    checkFillQueue: input.checkFillQueue,
    migrateIntent: input.migrateIntent,
    migrateAiReviewProvider: input.migrateAiReviewProvider,
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
    checkFillQueue: input.checkFillQueue ?? current.checkFillQueue,
    migrateIntent: input.migrateIntent ?? current.migrateIntent,
    migrateAiReviewProvider: input.migrateAiReviewProvider ?? current.migrateAiReviewProvider,
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
  if (session.mode === "reset_confirm") {
    if (command === "/confirm reset") {
      await resetArtistPersonaBlock(root);
      await resetSoulPersonaBlock(root);
      await cancelTelegramPersonaSession(root);
      return "Telegram-managed persona blocks were reset. Songs, ledgers, budget, and profiles were not touched.";
    }
    return "Persona reset is waiting for confirmation. Reply /confirm reset or /cancel.";
  }
  if (session.mode === "migrate_confirm") {
    if (command === "/confirm migrate") {
      const plan = await planPersonaMigrate(root, {
        intent: session.migrateIntent,
        aiReviewProvider: session.migrateAiReviewProvider
      });
      await executePersonaMigrate(root, plan);
      await cancelTelegramPersonaSession(root);
      return plan.warnings.includes("already migrated")
        ? "Persona is already migrated. No files were changed."
        : "Persona migrated into Telegram-managed marker blocks. Backup files were written first.";
    }
    return "Persona migrate is waiting for confirmation. Reply /confirm migrate or /cancel.";
  }
  if (command === "/back") {
    if (session.mode === "edit_field") {
      await updateTelegramPersonaSession(root, { pending: {}, stepIndex: 0, now });
      return formatEditPrompt(session.field);
    }
    const previous = session.history[session.history.length - 1];
    const stepIndex = isArtistPersonaPreviewStep(session)
      ? Math.max(artistPersonaQuestions.length - 1, 0)
      : isSoulPersonaPreviewStep(session)
        ? Math.max(soulPersonaQuestions.length - 1, 0)
        : previous?.stepIndex ?? Math.max(session.stepIndex - 1, 0);
    await updateTelegramPersonaSession(root, {
      stepIndex,
      history: session.history.slice(0, -1),
      now
    });
    return session.mode === "setup_soul" ? formatSoulPersonaQuestion(stepIndex) : formatArtistPersonaQuestion(stepIndex);
  }
  if (command === "/skip") {
    if (session.mode === "check_fill_chain") {
      const [nextField, ...rest] = session.checkFillQueue ?? [];
      if (!nextField) {
        await cancelTelegramPersonaSession(root);
        return "All fields complete. Use /persona show to review it.";
      }
      await updateTelegramPersonaSession(root, { field: nextField, checkFillQueue: rest, pending: {}, stepIndex: 0, now });
      return `Skipped. Next: ${nextField}. ${formatEditPrompt(nextField)}`;
    }
    return session.mode === "setup_soul"
      ? advanceSoulSetup(root, session, undefined, now, true)
      : advanceArtistSetup(root, session, undefined, now, true);
  }
  if (command.startsWith("/confirm")) {
    if (session.mode === "edit_field" || session.mode === "check_fill_chain") {
      return confirmEditField(root, session);
    }
    if (isSoulPersonaPreviewStep(session)) {
      await writeSoulPersona(root, session.pending);
      await cancelTelegramPersonaSession(root);
      return "SOUL saved. Use /persona show to review it.";
    }
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
  if (session.mode === "edit_field") {
    return stageEditField(root, session, text, now);
  }
  if (session.mode === "check_fill_chain") {
    return stageEditField(root, session, text, now);
  }
  return session.mode === "setup_soul"
    ? advanceSoulSetup(root, session, text, now, false)
    : advanceArtistSetup(root, session, text, now, false);
}

function isSoulPersonaPreviewStep(session: TelegramPersonaSession): boolean {
  return session.mode === "setup_soul" && session.stepIndex >= soulPersonaQuestions.length;
}

function artistFieldKey(field: PersonaField | undefined): keyof ArtistPersonaSummary | undefined {
  switch (field) {
    case "artistName":
    case "identityLine":
    case "soundDna":
    case "obsessions":
    case "lyricsRules":
    case "socialVoice":
      return field;
    default:
      return undefined;
  }
}

function soulFieldKey(field: PersonaField | undefined): keyof SoulPersonaSummary | undefined {
  switch (field) {
    case "soul-tone":
      return "conversationTone";
    case "soul-refusal":
      return "refusalStyle";
    default:
      return undefined;
  }
}

function formatEditPrompt(field: PersonaField | undefined): string {
  return `Send the new value for ${field ?? "this field"}. Reply /cancel to stop.`;
}

function formatEditPreview(field: PersonaField | undefined, value: string): string {
  return [
    "Persona edit preview:",
    `${field ?? "field"}: ${value}`,
    "",
    "Write this change? Reply /confirm or /back."
  ].join("\n");
}

async function stageEditField(root: string, session: TelegramPersonaSession, value: string, now: number): Promise<string> {
  const trimmed = value.trim();
  if (trimmed.length < 2) {
    return "Edit value is too short. Send a longer value or /cancel.";
  }
  await updateTelegramPersonaSession(root, {
    pending: { editValue: trimmed } as Partial<PersonaAnswers>,
    stepIndex: 1,
    now
  });
  return formatEditPreview(session.field, trimmed);
}

async function confirmEditField(root: string, session: TelegramPersonaSession): Promise<string> {
  const value = (session.pending as Partial<PersonaAnswers> & { editValue?: string }).editValue;
  if (!value) {
    return "No pending edit value yet. Send the new value first, or /cancel.";
  }
  const artistKey = artistFieldKey(session.field);
  const soulKey = soulFieldKey(session.field);
  if (artistKey) {
    await updateArtistPersonaField(root, artistKey, value);
  } else if (soulKey) {
    await updateSoulPersonaField(root, soulKey, value);
  } else {
    return "Unknown persona field. Send /persona fields for editable fields.";
  }
  if (session.mode !== "check_fill_chain") {
    await cancelTelegramPersonaSession(root);
    return "Persona field saved. Use /persona show to review it.";
  }
  const remaining = session.checkFillQueue ?? [];
  if (remaining.length === 0) {
    await cancelTelegramPersonaSession(root);
    return "Persona field saved. All fields complete. Use /persona show to review it.";
  }
  const [nextField, ...rest] = remaining;
  await updateTelegramPersonaSession(root, {
    field: nextField,
    checkFillQueue: rest,
    pending: {},
    stepIndex: 0
  });
  return `Persona field saved. Next: ${nextField}. ${formatEditPrompt(nextField)} Send /skip to skip this field.`;
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

async function advanceSoulSetup(
  root: string,
  session: TelegramPersonaSession,
  value: string | undefined,
  now: number,
  useDefault: boolean
): Promise<string> {
  if (session.mode !== "setup_soul") {
    return "This persona session mode cannot handle SOUL setup. Send /cancel to stop it.";
  }
  if (isSoulPersonaPreviewStep(session)) {
    return formatSoulPersonaPreview(session.pending);
  }
  const question = soulPersonaQuestions[session.stepIndex];
  if (!question) {
    await updateTelegramPersonaSession(root, { stepIndex: soulPersonaQuestions.length, now });
    return formatSoulPersonaPreview(session.pending);
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
      { stepIndex: session.stepIndex, field: question.field === "conversationTone" ? "soul-tone" : "soul-refusal" }
    ],
    now
  });
  const response = nextStepIndex >= soulPersonaQuestions.length
    ? formatSoulPersonaPreview(nextPending)
    : formatSoulPersonaQuestion(nextStepIndex);
  return useDefault ? `Skipped. Default saved for ${question.label}.\n\n${response}` : response;
}
