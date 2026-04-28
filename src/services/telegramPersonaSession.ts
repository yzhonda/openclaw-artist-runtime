import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  AiReviewProvider,
  PersonaAnswers,
  PersonaField,
  TelegramPersonaSession,
  TelegramPersonaSessionDraft,
  TelegramPersonaSessionMode
} from "../types.js";
import {
  resetArtistPersonaBlock,
  updateArtistPersonaField,
  writeArtistPersona,
  writePersonaCompletionMarker,
  type ArtistPersonaSummary
} from "./personaFileBuilder.js";
import { ensureBackupOnce } from "./personaBackup.js";
import {
  artistPersonaQuestions,
  formatArtistPersonaPreview,
  formatArtistPersonaQuestion,
  getArtistPersonaQuestion,
  isArtistPersonaPreviewStep
} from "./personaWizardQuestions.js";
import { executePersonaMigrate, planPersonaMigrate } from "./personaMigrator.js";
import { proposePersonaFields } from "./personaProposer.js";
import { secretLikePattern } from "./personaMigrator.js";
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

const setupAiFields: PersonaField[] = [
  "artistName",
  "identityLine",
  "soundDna",
  "obsessions",
  "lyricsRules",
  "socialVoice",
  "soul-tone",
  "soul-refusal"
];

export interface CreateTelegramPersonaSessionInput {
  mode: TelegramPersonaSessionMode;
  chatId: number;
  userId: number;
  field?: PersonaField;
  checkFillQueue?: PersonaField[];
  migrateIntent?: string;
  migrateAiReviewProvider?: AiReviewProvider;
  pending?: TelegramPersonaSession["pending"];
  now?: number;
  ttlMs?: number;
}

export interface UpdateTelegramPersonaSessionInput {
  mode?: TelegramPersonaSessionMode;
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
    pending: input.pending ?? {},
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
    mode: input.mode ?? current.mode,
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
  if (command.startsWith("/answer")) {
    const answer = text.replace(/^\/answer\b/i, "").trim();
    if (!answer) {
      return "Usage: /answer <text>";
    }
    if (session.mode === "setup_ai_rough") {
      return startSetupAiReview(root, session, answer, now);
    }
    if (session.mode === "setup_ai_review") {
      return answerSetupAiDraft(root, session, answer, now);
    }
    if (session.mode === "edit_field" || session.mode === "check_fill_chain") {
      return stageEditField(root, session, answer, now);
    }
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
    if (session.mode === "setup_ai_rough") {
      return setupAiRoughPrompt();
    }
    if (session.mode === "setup_ai_review") {
      if (session.stepIndex <= 0) {
        await updateTelegramPersonaSession(root, { mode: "setup_ai_rough", stepIndex: 0, now });
        return setupAiRoughPrompt();
      }
      const nextStepIndex = session.stepIndex - 1;
      await updateTelegramPersonaSession(root, {
        stepIndex: nextStepIndex,
        pending: { ...session.pending, skipCount: {} },
        now
      });
      return formatSetupAiDraft(session.pending.aiDrafts ?? [], nextStepIndex);
    }
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
    if (session.mode === "setup_ai_rough") {
      return handleSetupAiRoughSkip(root, session, now);
    }
    if (session.mode === "setup_ai_review") {
      return skipSetupAiDraft(root, session, now);
    }
    if (session.mode === "check_fill_chain") {
      if (isCheckFillAiSession(session)) {
        return skipCheckFillAiDraft(root, session, now);
      }
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
    if (session.mode === "setup_ai_review") {
      return confirmSetupAiDraft(root, session, command, now);
    }
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
  if (session.mode === "setup_ai_rough") {
    return startSetupAiReview(root, session, text, now);
  }
  if (session.mode === "setup_ai_review") {
    return answerSetupAiDraft(root, session, text, now);
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

function setupAiRoughPrompt(): string {
  return [
    "Send a rough 1-2 sentence artist sketch.",
    "Example: 和風 hip-hop で社会風刺がメインの男性アーティスト、20代",
    "Commands: /skip repeats this prompt, /cancel stops setup."
  ].join("\n");
}

function fieldAnswerKey(field: PersonaField): keyof PersonaAnswers {
  switch (field) {
    case "soul-tone":
      return "conversationTone";
    case "soul-refusal":
      return "refusalStyle";
    default:
      return field;
  }
}

function defaultForSetupAiField(field: PersonaField): string {
  const artistQuestion = artistPersonaQuestions.find((question) => question.field === field);
  if (artistQuestion) {
    return artistQuestion.defaultValue;
  }
  return field === "soul-tone" ? soulPersonaQuestions[0].defaultValue : soulPersonaQuestions[1].defaultValue;
}

function validateSetupAiField(field: PersonaField, value: string): string | undefined {
  const artistQuestion = artistPersonaQuestions.find((question) => question.field === field);
  if (artistQuestion) {
    return artistQuestion.validate(value);
  }
  const soulQuestion = field === "soul-tone" ? soulPersonaQuestions[0] : soulPersonaQuestions[1];
  return soulQuestion.validate(value);
}

function defaultSetupAiDrafts(): TelegramPersonaSessionDraft[] {
  return setupAiFields.map((field) => ({
    field,
    draft: defaultForSetupAiField(field),
    reasoning: "Plan v9.6 default value",
    status: "proposed"
  }));
}

function formatSetupAiDraft(drafts: TelegramPersonaSessionDraft[], stepIndex: number): string {
  const draft = drafts[stepIndex];
  if (!draft) {
    return "All AI drafts are complete. Reply /confirm to write ARTIST.md and SOUL.md.";
  }
  return [
    `Field ${stepIndex + 1}/${setupAiFields.length}: ${draft.field}`,
    `AI draft: ${draft.draft || defaultForSetupAiField(draft.field)}`,
    draft.reasoning ? `Reasoning: ${draft.reasoning}` : undefined,
    "",
    "Commands: /confirm accepts, /answer <text> overrides, /skip asks for another draft, /back goes back, /cancel stops setup."
  ].filter(Boolean).join("\n");
}

function allCheckFillFields(session: TelegramPersonaSession): PersonaField[] {
  return [session.field, ...(session.checkFillQueue ?? [])].filter((field): field is PersonaField => Boolean(field));
}

function isCheckFillAiSession(session: TelegramPersonaSession): boolean {
  return session.mode === "check_fill_chain" && Array.isArray(session.pending.aiDrafts);
}

function draftForField(session: TelegramPersonaSession, field: PersonaField | undefined): TelegramPersonaSessionDraft | undefined {
  return field ? session.pending.aiDrafts?.find((draft) => draft.field === field) : undefined;
}

function formatCheckFillAiDraft(session: TelegramPersonaSession): string {
  const draft = draftForField(session, session.field);
  if (!draft || !session.field) {
    return "All fields complete. Use /persona show to review it.";
  }
  const drafts = session.pending.aiDrafts ?? [];
  const position = drafts.findIndex((candidate) => candidate.field === session.field) + 1;
  const total = drafts.length || allCheckFillFields(session).length;
  return [
    `Persona fill draft ${position}/${total}: ${draft.field}`,
    `AI draft: ${draft.draft || defaultForSetupAiField(draft.field)}`,
    draft.reasoning ? `Reasoning: ${draft.reasoning}` : undefined,
    draft.status === "skipped" ? "Warning: this field was skipped by the proposer." : undefined,
    "",
    "Commands: /confirm accepts, /answer <text> overrides, /skip asks for another draft, /cancel stops."
  ].filter(Boolean).join("\n");
}

async function replaceCheckFillAiDraft(
  root: string,
  session: TelegramPersonaSession,
  field: PersonaField,
  now: number
): Promise<TelegramPersonaSessionDraft[]> {
  const currentDrafts = session.pending.aiDrafts ?? [];
  const [artistMd, soulMd] = await Promise.all([
    readFile(join(root, "ARTIST.md"), "utf8").catch(() => ""),
    readFile(join(root, "SOUL.md"), "utf8").catch(() => "")
  ]);
  const result = await proposePersonaFields({
    fields: [field],
    source: {
      artistMd,
      soulMd,
      roughInput: `Alternative draft for ${field}. Use the existing ARTIST.md and SOUL.md context.`
    }
  });
  const replacement = result.drafts[0] ?? {
    field,
    draft: defaultForSetupAiField(field),
    reasoning: "fallback default",
    status: "proposed"
  };
  const nextDrafts = currentDrafts.map((draft) =>
    draft.field === field
      ? {
          field,
          draft: replacement.draft || defaultForSetupAiField(field),
          reasoning: replacement.reasoning ?? "alternative mock draft",
          status: replacement.status
        }
      : draft
  );
  await updateTelegramPersonaSession(root, {
    pending: {
      ...session.pending,
      aiDrafts: nextDrafts,
      skipCount: { ...session.pending.skipCount, [field]: (session.pending.skipCount?.[field] ?? 0) + 1 }
    },
    now
  });
  return nextDrafts;
}

async function skipCheckFillAiDraft(root: string, session: TelegramPersonaSession, now: number): Promise<string> {
  if (!session.field) {
    return "All fields complete. Use /persona show to review it.";
  }
  const skipCount = session.pending.skipCount?.[session.field] ?? 0;
  if (skipCount === 0) {
    const nextDrafts = await replaceCheckFillAiDraft(root, session, session.field, now);
    return [
      "Alternative draft generated.",
      "",
      formatCheckFillAiDraft({ ...session, pending: { ...session.pending, aiDrafts: nextDrafts } })
    ].join("\n");
  }
  await updateTelegramPersonaSession(root, {
    pending: { ...session.pending, skipCount: { ...session.pending.skipCount, [session.field]: skipCount + 1 } },
    now
  });
  return `Skip ${session.field}? Reply /confirm skip to leave this field unchanged, or /answer <text> to override.`;
}

async function handleSetupAiRoughSkip(root: string, session: TelegramPersonaSession, now: number): Promise<string> {
  const roughSkipCount = (session.pending.roughSkipCount ?? 0) + 1;
  if (roughSkipCount < 3) {
    await updateTelegramPersonaSession(root, {
      pending: { ...session.pending, roughSkipCount },
      now
    });
    return setupAiRoughPrompt();
  }
  const drafts = defaultSetupAiDrafts();
  await updateTelegramPersonaSession(root, {
    mode: "setup_ai_review",
    stepIndex: 0,
    pending: { aiDrafts: drafts, skipCount: {}, roughSkipCount },
    now
  });
  return ["No rough sketch received after 3 skips. Using default AI setup drafts.", "", formatSetupAiDraft(drafts, 0)].join("\n");
}

async function startSetupAiReview(
  root: string,
  session: TelegramPersonaSession,
  roughInput: string,
  now: number
): Promise<string> {
  const normalized = roughInput.trim();
  if (!normalized) {
    return setupAiRoughPrompt();
  }
  if (secretLikePattern.test(normalized)) {
    await updateTelegramPersonaSession(root, {
      mode: "setup_ai_rough",
      stepIndex: 0,
      pending: { ...session.pending, roughSkipCount: 0 },
      now
    });
    return "Secret-like text detected. Please describe the artist again without tokens, cookies, keys, or credentials.";
  }
  const result = await proposePersonaFields({
    fields: setupAiFields,
    source: { artistMd: "", soulMd: "", roughInput: normalized }
  });
  const drafts = result.drafts.map((draft): TelegramPersonaSessionDraft => ({
    field: draft.field,
    draft: draft.status === "skipped" ? defaultForSetupAiField(draft.field) : draft.draft,
    reasoning: draft.reasoning,
    status: draft.status
  }));
  await updateTelegramPersonaSession(root, {
    mode: "setup_ai_review",
    stepIndex: 0,
    pending: { aiDrafts: drafts, skipCount: {}, roughSkipCount: session.pending.roughSkipCount },
    now
  });
  return [
    "Rough sketch received. AI drafts are ready.",
    result.warnings.length > 0 ? `Warnings: ${result.warnings.join("; ")}` : undefined,
    "",
    formatSetupAiDraft(drafts, 0)
  ].filter(Boolean).join("\n");
}

async function replaceSetupAiDraft(
  root: string,
  session: TelegramPersonaSession,
  field: PersonaField,
  now: number
): Promise<TelegramPersonaSessionDraft[]> {
  const currentDrafts = session.pending.aiDrafts ?? defaultSetupAiDrafts();
  const result = await proposePersonaFields({
    fields: [field],
    source: {
      artistMd: "",
      soulMd: "",
      roughInput: `Alternative draft for ${field}. Avoid repeating the previous draft exactly.`
    }
  });
  const replacement = result.drafts[0] ?? {
    field,
    draft: defaultForSetupAiField(field),
    reasoning: "fallback default",
    status: "proposed"
  };
  const nextDrafts = currentDrafts.map((draft, index) =>
    index === session.stepIndex
      ? {
          field,
          draft: replacement.draft || defaultForSetupAiField(field),
          reasoning: replacement.reasoning ?? "alternative mock draft",
          status: replacement.status
        }
      : draft
  );
  await updateTelegramPersonaSession(root, {
    pending: {
      ...session.pending,
      aiDrafts: nextDrafts,
      skipCount: { ...session.pending.skipCount, [field]: (session.pending.skipCount?.[field] ?? 0) + 1 }
    },
    now
  });
  return nextDrafts;
}

async function skipSetupAiDraft(root: string, session: TelegramPersonaSession, now: number): Promise<string> {
  const draft = (session.pending.aiDrafts ?? defaultSetupAiDrafts())[session.stepIndex];
  if (!draft) {
    return "AI setup is complete. Reply /confirm to write ARTIST.md and SOUL.md.";
  }
  const skipCount = session.pending.skipCount?.[draft.field] ?? 0;
  if (skipCount === 0) {
    const nextDrafts = await replaceSetupAiDraft(root, session, draft.field, now);
    return ["Alternative draft generated.", "", formatSetupAiDraft(nextDrafts, session.stepIndex)].join("\n");
  }
  await updateTelegramPersonaSession(root, {
    pending: { ...session.pending, skipCount: { ...session.pending.skipCount, [draft.field]: skipCount + 1 } },
    now
  });
  return `Skip ${draft.field}? Reply /confirm skip to use the default value and continue, or /answer <text> to override.`;
}

async function confirmSetupAiDraft(
  root: string,
  session: TelegramPersonaSession,
  command: string,
  now: number
): Promise<string> {
  const drafts = session.pending.aiDrafts ?? defaultSetupAiDrafts();
  const draft = drafts[session.stepIndex];
  if (!draft) {
    await Promise.all([writeArtistPersona(root, session.pending), writeSoulPersona(root, session.pending)]);
    await writePersonaCompletionMarker(root, new Date(now));
    await cancelTelegramPersonaSession(root);
    return "Persona saved. ARTIST.md and SOUL.md were written from AI setup drafts. Use /persona show to review it.";
  }
  const useDefault = command === "/confirm skip";
  const value = useDefault ? defaultForSetupAiField(draft.field) : draft.draft || defaultForSetupAiField(draft.field);
  const validationError = validateSetupAiField(draft.field, value);
  if (validationError) {
    return validationError;
  }
  const key = fieldAnswerKey(draft.field);
  const nextPending = {
    ...session.pending,
    [key]: value,
    skipCount: {},
    aiDrafts: drafts
  };
  const nextStepIndex = session.stepIndex + 1;
  await updateTelegramPersonaSession(root, {
    stepIndex: nextStepIndex,
    pending: nextPending,
    history: [
      ...session.history,
      { stepIndex: session.stepIndex, field: draft.field, previous: session.pending[key] }
    ],
    now
  });
  return nextStepIndex >= setupAiFields.length
    ? "All AI setup fields are selected. Reply /confirm to write ARTIST.md and SOUL.md, or /back to revise."
    : formatSetupAiDraft(drafts, nextStepIndex);
}

async function answerSetupAiDraft(
  root: string,
  session: TelegramPersonaSession,
  answer: string,
  now: number
): Promise<string> {
  const draft = (session.pending.aiDrafts ?? defaultSetupAiDrafts())[session.stepIndex];
  if (!draft) {
    return "All AI setup fields are selected. Reply /confirm to write ARTIST.md and SOUL.md, or /back to revise.";
  }
  const value = answer.trim();
  const validationError = validateSetupAiField(draft.field, value);
  if (validationError) {
    return validationError;
  }
  const key = fieldAnswerKey(draft.field);
  const nextPending = {
    ...session.pending,
    [key]: value,
    skipCount: {},
    aiDrafts: session.pending.aiDrafts ?? defaultSetupAiDrafts()
  };
  const nextStepIndex = session.stepIndex + 1;
  await updateTelegramPersonaSession(root, {
    stepIndex: nextStepIndex,
    pending: nextPending,
    history: [
      ...session.history,
      { stepIndex: session.stepIndex, field: draft.field, previous: session.pending[key] }
    ],
    now
  });
  return nextStepIndex >= setupAiFields.length
    ? "All AI setup fields are selected. Reply /confirm to write ARTIST.md and SOUL.md, or /back to revise."
    : formatSetupAiDraft(nextPending.aiDrafts ?? [], nextStepIndex);
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
    pending: { ...session.pending, editValue: trimmed },
    stepIndex: 1,
    now
  });
  return formatEditPreview(session.field, trimmed);
}

async function confirmEditField(root: string, session: TelegramPersonaSession): Promise<string> {
  const aiDraft = isCheckFillAiSession(session) ? draftForField(session, session.field) : undefined;
  const aiDraftSkipCount = aiDraft ? session.pending.skipCount?.[aiDraft.field] ?? 0 : 0;
  const isSkipConfirm = Boolean(aiDraft && aiDraftSkipCount >= 2);
  const value = isSkipConfirm
    ? undefined
    : (session.pending as Partial<PersonaAnswers> & { editValue?: string }).editValue ?? aiDraft?.draft;
  if (!value) {
    if (isSkipConfirm && session.mode === "check_fill_chain") {
      return advanceCheckFillChain(root, session, "Skipped.");
    }
    return "No pending edit value yet. Send the new value first, or /cancel.";
  }
  const artistKey = artistFieldKey(session.field);
  const soulKey = soulFieldKey(session.field);
  if (session.mode === "check_fill_chain") {
    await Promise.all([
      artistKey ? ensureBackupOnce(root, `check-fill:${session.startedAt}:${session.chatId}:${session.userId}`, "ARTIST") : Promise.resolve(null),
      soulKey ? ensureBackupOnce(root, `check-fill:${session.startedAt}:${session.chatId}:${session.userId}`, "SOUL") : Promise.resolve(null)
    ]);
  }
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
  return advanceCheckFillChain(root, session, "Persona field saved.");
}

async function advanceCheckFillChain(root: string, session: TelegramPersonaSession, prefix: string): Promise<string> {
  const remaining = session.checkFillQueue ?? [];
  if (remaining.length === 0) {
    await cancelTelegramPersonaSession(root);
    return `${prefix} All fields complete. Use /persona show to review it.`;
  }
  const [nextField, ...rest] = remaining;
  const nextPending = isCheckFillAiSession(session)
    ? { ...session.pending, editValue: undefined, skipCount: {}, aiDrafts: session.pending.aiDrafts }
    : {};
  await updateTelegramPersonaSession(root, {
    field: nextField,
    checkFillQueue: rest,
    pending: nextPending,
    stepIndex: 0
  });
  if (isCheckFillAiSession(session)) {
    return `${prefix} Next: ${nextField}. ${formatCheckFillAiDraft({ ...session, field: nextField, checkFillQueue: rest, pending: nextPending })}`;
  }
  return `${prefix} Next: ${nextField}. ${formatEditPrompt(nextField)} Send /skip to skip this field.`;
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
