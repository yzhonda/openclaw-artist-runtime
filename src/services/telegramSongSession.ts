import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { AiReviewProvider, SongSessionMode, SongStatus, SongUpdateField } from "../types.js";
import { songUpdateFields } from "../types.js";
import { updateSongState, writeSongBrief } from "./artistState.js";
import { backupPathIfPresentOnce } from "./personaBackup.js";
import { secretLikePattern } from "./personaMigrator.js";
import { proposeSongFields, type SongFieldDraft } from "./songProposer.js";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const updateFields: SongUpdateField[] = [
  "status",
  "publicLinksSpotify",
  "publicLinksAppleMusic",
  "publicLinksYoutubeMusic",
  "selectedTake",
  "notes"
];
const addFields: SongUpdateField[] = ["title", "brief", "style", "lyrics", "notes"];

interface TelegramSongSession {
  active: boolean;
  mode: SongSessionMode;
  stepIndex: number;
  songId?: string;
  queue: SongUpdateField[];
  aiReviewProvider?: AiReviewProvider;
  pending: {
    drafts?: SongFieldDraft[];
    values?: Partial<Record<SongUpdateField, string>>;
    editValue?: string;
    skipCount?: Partial<Record<SongUpdateField, number>>;
    roughInput?: string;
  };
  startedAt: number;
  updatedAt: number;
  chatId: number;
  userId: number;
  expiresAt: number;
}

export function telegramSongSessionPath(root: string): string {
  return join(root, "runtime", "telegram-song-session.json");
}

function nowStamp(now = new Date()): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function sessionId(session: TelegramSongSession): string {
  return `song:${session.startedAt}:${session.chatId}:${session.userId}:${session.songId ?? "new"}`;
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(() => true, () => false);
}

async function uniqueBackupPath(path: string): Promise<string> {
  const base = `${path}.backup-${nowStamp()}`;
  if (!(await exists(base))) {
    return base;
  }
  for (let index = 1; index < 1000; index += 1) {
    const candidate = `${base}.${index}`;
    if (!(await exists(candidate))) {
      return candidate;
    }
  }
  throw new Error("song_backup_path_exhausted");
}

async function backupIfPresentOnce(path: string, session: TelegramSongSession): Promise<string | null> {
  return backupPathIfPresentOnce(path, await uniqueBackupPath(path), sessionId(session));
}

function songPath(root: string, songId: string): string {
  return join(root, "songs", songId, "song.md");
}

function songbookPath(root: string): string {
  return join(root, "artist", "SONGBOOK.md");
}

async function writeSession(root: string, session: TelegramSongSession): Promise<TelegramSongSession> {
  const path = telegramSongSessionPath(root);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(session, null, 2)}\n`, "utf8");
  return session;
}

function isSession(value: Partial<TelegramSongSession>): value is TelegramSongSession {
  return (
    value.active === true &&
    typeof value.mode === "string" &&
    typeof value.stepIndex === "number" &&
    Array.isArray(value.queue) &&
    typeof value.pending === "object" &&
    typeof value.startedAt === "number" &&
    typeof value.updatedAt === "number" &&
    typeof value.chatId === "number" &&
    typeof value.userId === "number" &&
    typeof value.expiresAt === "number"
  );
}

export async function readTelegramSongSession(root: string, now = Date.now()): Promise<TelegramSongSession | undefined> {
  const contents = await readFile(telegramSongSessionPath(root), "utf8").catch(() => "");
  if (!contents) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(contents) as Partial<TelegramSongSession>;
    return isSession(parsed) && parsed.expiresAt > now ? parsed : undefined;
  } catch {
    return undefined;
  }
}

async function updateTelegramSongSession(
  root: string,
  session: TelegramSongSession,
  patch: Partial<TelegramSongSession>,
  now = Date.now()
): Promise<TelegramSongSession> {
  return writeSession(root, {
    ...session,
    ...patch,
    pending: patch.pending ?? session.pending,
    updatedAt: now,
    expiresAt: now + SESSION_TTL_MS
  });
}

export async function cancelTelegramSongSession(root: string): Promise<void> {
  await unlink(telegramSongSessionPath(root)).catch(() => undefined);
}

async function readSongContext(root: string, songId: string, roughInput?: string) {
  const [songMd, briefMd, songbookEntry, currentState] = await Promise.all([
    readFile(songPath(root, songId), "utf8").catch(() => ""),
    readFile(join(root, "songs", songId, "brief.md"), "utf8").catch(() => ""),
    readFile(songbookPath(root), "utf8").catch(() => ""),
    readFile(join(root, "artist", "CURRENT_STATE.md"), "utf8").catch(() => "")
  ]);
  return { songId, songMd, briefMd, songbookEntry, currentState, roughInput };
}

async function proposeForFields(
  root: string,
  fields: SongUpdateField[],
  songId: string,
  provider?: AiReviewProvider,
  roughInput?: string
): Promise<{ drafts: SongFieldDraft[]; warnings: string[]; provider: string }> {
  const result = await proposeSongFields({
    fields,
    source: await readSongContext(root, songId, roughInput)
  }, { aiReviewProvider: provider });
  return { drafts: result.drafts, warnings: result.warnings, provider: result.provider };
}

function currentField(session: TelegramSongSession): SongUpdateField | undefined {
  return session.queue[session.stepIndex];
}

function draftForCurrent(session: TelegramSongSession): SongFieldDraft | undefined {
  const field = currentField(session);
  return field ? session.pending.drafts?.find((draft) => draft.field === field) : undefined;
}

function formatDraft(session: TelegramSongSession, prefix = "Song draft"): string {
  const field = currentField(session);
  const draft = draftForCurrent(session);
  if (!field || !draft) {
    return "Song wizard fields are complete. Reply /confirm to write files, or /back to revise.";
  }
  return [
    `${prefix} ${session.stepIndex + 1}/${session.queue.length}: ${field}`,
    `AI draft: ${draft.draft}`,
    draft.reasoning ? `Reasoning: ${draft.reasoning}` : undefined,
    draft.status === "skipped" ? "Warning: proposer skipped this field." : undefined,
    "Commands: /confirm accepts, /answer <text> overrides, /skip asks for another draft, /back goes back, /cancel stops."
  ].filter(Boolean).join("\n");
}

function normalizeStatus(value: string): SongStatus | undefined {
  const normalized = value.trim();
  switch (normalized) {
    case "idea":
    case "brief":
    case "lyrics":
    case "suno_prompt_pack":
    case "suno_running":
    case "takes_imported":
    case "take_selected":
    case "social_assets":
    case "scheduled":
    case "published":
    case "archived":
    case "failed":
      return normalized;
    default:
      return undefined;
  }
}

function linkValue(value: string): string | undefined {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : undefined;
}

async function appendSection(path: string, heading: string, value: string): Promise<void> {
  const current = await readFile(path, "utf8").catch(() => "");
  const next = `${current.trimEnd()}\n\n## ${heading}\n\n${value.trim()}\n`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, next, "utf8");
}

async function writeUpdateField(
  root: string,
  session: TelegramSongSession,
  field: SongUpdateField,
  value: string
): Promise<void> {
  const songId = session.songId;
  if (!songId) {
    return;
  }
  await Promise.all([
    backupIfPresentOnce(songPath(root, songId), session),
    backupIfPresentOnce(songbookPath(root), session)
  ]);
  if (field === "status") {
    const status = normalizeStatus(value);
    if (status) {
      await updateSongState(root, songId, { status, reason: "telegram song update" });
    }
    return;
  }
  if (field.startsWith("publicLinks")) {
    const link = linkValue(value);
    if (link) {
      await updateSongState(root, songId, { appendPublicLinks: [link], reason: "telegram song update" });
    }
    return;
  }
  if (field === "selectedTake" && value.trim() && value.trim() !== "TBD") {
    await updateSongState(root, songId, { selectedTakeId: value.trim(), status: "take_selected", reason: "telegram song update" });
    return;
  }
  if (field === "notes" && value.trim()) {
    await appendSection(songPath(root, songId), "Telegram Update Notes", value);
    await updateSongState(root, songId, { reason: "telegram song notes updated" });
  }
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || `song-${nowStamp().toLowerCase()}`;
}

async function uniqueSongId(root: string, title: string): Promise<string> {
  const base = slugify(title);
  if (!(await exists(join(root, "songs", base)))) {
    return base;
  }
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${base}-${index}`;
    if (!(await exists(join(root, "songs", candidate)))) {
      return candidate;
    }
  }
  throw new Error("song_id_exhausted");
}

async function writeNewSong(root: string, session: TelegramSongSession): Promise<string> {
  const values = session.pending.values ?? {};
  const title = values.title?.trim() || "Untitled OpenClaw Song";
  const songId = await uniqueSongId(root, title);
  await mkdir(join(root, "songs", songId, "lyrics"), { recursive: true });
  await writeSongBrief(root, songId, values.brief || `# Brief for ${songId}\n\n${title}`);
  await updateSongState(root, songId, { title, status: "brief", reason: "telegram song add" });
  if (values.style) {
    await appendSection(songPath(root, songId), "Style Direction", values.style);
  }
  if (values.notes) {
    await appendSection(songPath(root, songId), "Telegram Notes", values.notes);
  }
  if (values.lyrics) {
    await writeFile(join(root, "songs", songId, "lyrics", "lyrics.v1.md"), `${values.lyrics.trim()}\n`, "utf8");
    await updateSongState(root, songId, { status: "lyrics", lyricsVersion: 1, reason: "telegram song add lyrics" });
  }
  return songId;
}

export async function startTelegramSongUpdateSession(
  root: string,
  input: { songId: string; chatId: number; userId: number; aiReviewProvider?: AiReviewProvider; now?: number }
): Promise<string> {
  const now = input.now ?? Date.now();
  const proposals = await proposeForFields(root, updateFields, input.songId, input.aiReviewProvider, "Telegram song update wizard.");
  const session = await writeSession(root, {
    active: true,
    mode: "song_update_chain",
    stepIndex: 0,
    songId: input.songId,
    queue: updateFields,
    aiReviewProvider: input.aiReviewProvider,
    pending: { drafts: proposals.drafts, skipCount: {}, values: {} },
    startedAt: now,
    updatedAt: now,
    chatId: input.chatId,
    userId: input.userId,
    expiresAt: now + SESSION_TTL_MS
  });
  return [
    `Song update wizard started for ${input.songId}.`,
    proposals.warnings.length > 0 ? `Warnings: ${proposals.warnings.join("; ")}` : undefined,
    formatDraft(session)
  ].filter(Boolean).join("\n");
}

export async function startTelegramSongAddSession(
  root: string,
  input: { chatId: number; userId: number; aiReviewProvider?: AiReviewProvider; now?: number }
): Promise<string> {
  const now = input.now ?? Date.now();
  await writeSession(root, {
    active: true,
    mode: "song_add_rough",
    stepIndex: 0,
    queue: addFields,
    aiReviewProvider: input.aiReviewProvider,
    pending: {},
    startedAt: now,
    updatedAt: now,
    chatId: input.chatId,
    userId: input.userId,
    expiresAt: now + SESSION_TTL_MS
  });
  return "Song add wizard started. Send a rough 1-2 sentence song idea, or /cancel.";
}

async function startSongAddReview(root: string, session: TelegramSongSession, roughInput: string, now: number): Promise<string> {
  const normalized = roughInput.trim();
  if (!normalized) {
    return "Send a rough 1-2 sentence song idea, or /cancel.";
  }
  if (secretLikePattern.test(normalized)) {
    return "Secret-like text detected. Please describe the song again without tokens, cookies, keys, or credentials.";
  }
  const scratchId = "new-song";
  const proposals = await proposeForFields(root, addFields, scratchId, session.aiReviewProvider, normalized);
  const next = await updateTelegramSongSession(root, session, {
    mode: "song_add_review",
    stepIndex: 0,
    songId: scratchId,
    pending: { drafts: proposals.drafts, skipCount: {}, values: {}, roughInput: normalized }
  }, now);
  return [
    "Rough song idea received. AI drafts are ready.",
    proposals.warnings.length > 0 ? `Warnings: ${proposals.warnings.join("; ")}` : undefined,
    formatDraft(next, "New song draft")
  ].filter(Boolean).join("\n");
}

async function replaceCurrentDraft(root: string, session: TelegramSongSession, now: number): Promise<string> {
  const field = currentField(session);
  if (!field) {
    return "Song wizard fields are complete.";
  }
  const skipCount = session.pending.skipCount?.[field] ?? 0;
  if (skipCount > 0) {
    await updateTelegramSongSession(root, session, {
      pending: { ...session.pending, skipCount: { ...session.pending.skipCount, [field]: skipCount + 1 } }
    }, now);
    return `Skip ${field}? Reply /confirm skip to leave it unchanged, or /answer <text> to override.`;
  }
  const result = await proposeForFields(
    root,
    [field],
    session.songId ?? "new-song",
    session.aiReviewProvider,
    `Alternative draft for ${field}. ${session.pending.roughInput ?? ""}`
  );
  const replacement = result.drafts[0];
  const drafts = (session.pending.drafts ?? []).map((draft) => draft.field === field && replacement ? replacement : draft);
  const next = await updateTelegramSongSession(root, session, {
    pending: { ...session.pending, drafts, skipCount: { ...session.pending.skipCount, [field]: 1 } }
  }, now);
  return ["Alternative draft generated.", formatDraft(next)].join("\n\n");
}

async function confirmCurrent(root: string, session: TelegramSongSession, command: string, now: number): Promise<string> {
  const field = currentField(session);
  if (!field) {
    if (session.mode === "song_add_review") {
      const songId = await writeNewSong(root, session);
      await cancelTelegramSongSession(root);
      return `Song created: ${songId}. Use /song ${songId} to review it.`;
    }
    await cancelTelegramSongSession(root);
    return "Song update complete.";
  }
  const draft = draftForCurrent(session);
  const useSkip = command === "/confirm skip";
  const value = useSkip ? "" : (session.pending.editValue ?? draft?.draft ?? "").trim();
  const values = { ...session.pending.values, [field]: value };
  if (session.mode === "song_update_chain" && value) {
    await writeUpdateField(root, session, field, value);
  }
  const nextStepIndex = session.stepIndex + 1;
  const next = await updateTelegramSongSession(root, session, {
    stepIndex: nextStepIndex,
    pending: { ...session.pending, values, editValue: undefined, skipCount: {} }
  }, now);
  if (nextStepIndex >= session.queue.length) {
    if (session.mode === "song_add_review") {
      return "All song fields are selected. Reply /confirm to write the new song, or /back to revise.";
    }
    await cancelTelegramSongSession(root);
    return "Song update complete. SONGBOOK.md and song.md were updated with backups where files existed.";
  }
  return formatDraft(next);
}

async function stageAnswer(root: string, session: TelegramSongSession, value: string, now: number): Promise<string> {
  const trimmed = value.trim();
  if (trimmed.length < 1) {
    return "Answer is empty. Send a value, /skip, or /cancel.";
  }
  await updateTelegramSongSession(root, session, {
    pending: { ...session.pending, editValue: trimmed }
  }, now);
  const field = currentField(session);
  return [
    "Song edit preview:",
    `${field}: ${trimmed}`,
    "",
    "Write this value? Reply /confirm or /back."
  ].join("\n");
}

export async function handleTelegramSongSessionMessage(
  root: string,
  text: string,
  now = Date.now()
): Promise<string | undefined> {
  const session = await readTelegramSongSession(root, now);
  if (!session) {
    return undefined;
  }
  const command = text.trim().toLowerCase();
  if (command === "/cancel") {
    await cancelTelegramSongSession(root);
    return "Song wizard cancelled. No further song changes were written.";
  }
  if (session.mode === "song_add_rough") {
    if (command.startsWith("/")) {
      return "Song add is waiting for a rough idea. Send text or /cancel.";
    }
    return startSongAddReview(root, session, text, now);
  }
  if (command === "/back") {
    const nextStepIndex = Math.max(session.stepIndex - 1, 0);
    const next = await updateTelegramSongSession(root, session, {
      stepIndex: nextStepIndex,
      pending: { ...session.pending, editValue: undefined, skipCount: {} }
    }, now);
    return formatDraft(next);
  }
  if (command === "/skip") {
    return replaceCurrentDraft(root, session, now);
  }
  if (command.startsWith("/answer")) {
    return stageAnswer(root, session, text.replace(/^\/answer\b/i, ""), now);
  }
  if (command.startsWith("/confirm")) {
    return confirmCurrent(root, session, command, now);
  }
  if (command.startsWith("/")) {
    return "Song wizard is active. Send an answer, /confirm, /answer <text>, /skip, /back, or /cancel.";
  }
  return stageAnswer(root, session, text, now);
}

export function isSupportedSongCommand(value: string | undefined): boolean {
  return Boolean(value && songUpdateFields.includes(value as SongUpdateField));
}
