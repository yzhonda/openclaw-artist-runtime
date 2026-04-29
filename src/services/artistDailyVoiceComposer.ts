import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AiReviewProvider, DailyVoiceDraft } from "../types.js";
import { callAiProvider } from "./aiProviderClient.js";
import { listSongStates } from "./artistState.js";
import { secretLikePattern } from "./personaMigrator.js";

export interface ComposeDailyVoiceOptions {
  aiReviewProvider?: AiReviewProvider;
  now?: Date;
}

const maxBodyChars = 256;

function assertSafe(label: string, value: string): void {
  if (secretLikePattern.test(value)) {
    throw new Error(`${label}_contains_secret_like_text`);
  }
}

function normalizeText(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}

export function hashDailyVoiceDraft(value: string): string {
  return createHash("sha256").update(normalizeText(value)).digest("hex");
}

function fitDraft(value: string): string {
  const compact = normalizeText(value)
    .replace(/#[\p{L}\p{N}_-]+/gu, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const chars = Array.from(compact);
  if (chars.length <= maxBodyChars) {
    return compact;
  }
  const room = maxBodyChars - 1;
  const sliced = chars.slice(0, room).join("");
  const boundary = Math.max(
    sliced.lastIndexOf("。"),
    sliced.lastIndexOf("、"),
    sliced.lastIndexOf("."),
    sliced.lastIndexOf(" "),
    sliced.lastIndexOf("\n")
  );
  return `${(boundary > Math.floor(room * 0.5) ? sliced.slice(0, boundary) : sliced).trim()}…`;
}

function anon(label: string, value: string, max = 120): string {
  const safe = value
    .split(/\r?\n/)
    .map((line) => secretLikePattern.test(line) ? "[private line redacted]" : line.trim())
    .filter(Boolean)
    .join(" ");
  return `${label}: ${safe.slice(0, max)}`;
}

async function latestObservation(root: string): Promise<string> {
  const dir = join(root, "observations");
  const entries = await readdir(dir).catch(() => []);
  const latest = entries.filter((entry) => entry.endsWith(".md")).sort().at(-1);
  return latest ? readFile(join(dir, latest), "utf8").catch(() => "") : "";
}

async function latestSongFragment(root: string): Promise<string> {
  const songs = await listSongStates(root).catch(() => []);
  const latest = songs[0];
  if (!latest) {
    return "";
  }
  const [brief, style, lyrics] = await Promise.all([
    readFile(join(root, "songs", latest.songId, "brief.md"), "utf8").catch(() => ""),
    readFile(join(root, "songs", latest.songId, "style.md"), "utf8").catch(() => ""),
    readFile(join(root, "songs", latest.songId, "lyrics.md"), "utf8").catch(() => "")
  ]);
  return [latest.title, latest.lastReason, brief, style, lyrics].filter(Boolean).join("\n");
}

function mockDraft(context: { artistMd: string; soulMd: string; observation: string; fragment: string }): string {
  const obsession = context.artistMd.match(/obsessions?:\s*(.+)/i)?.[1]?.trim()
    ?? context.observation.split(/\r?\n/).find(Boolean)
    ?? "街の端が今日も少しだけ欠けていた";
  const tone = context.soulMd.match(/tone:\s*(.+)/i)?.[1]?.trim() ?? "観察ベースで短く";
  return fitDraft(`${obsession}\n\n${tone}。言い切らず、でも目は逸らさない。`);
}

function buildPrompt(context: { artistMd: string; soulMd: string; observation: string; heartbeat: string; fragment: string }): string {
  return [
    "Write one natural X post as the artist used::honda.",
    "This is not a song announcement. It is an everyday artist voice note.",
    "Tone: observational, intelligent, lightly satirical if earned, never bot-like, no boilerplate, no hashtags by default.",
    `Length: ${maxBodyChars} characters max. Do not include URLs unless supplied. Do not include secrets.`,
    "",
    "ARTIST.md:",
    context.artistMd.slice(0, 1800),
    "",
    "SOUL.md:",
    context.soulMd.slice(0, 1000),
    "",
    "Recent observation:",
    context.observation.slice(0, 1000),
    "",
    "Heartbeat state:",
    context.heartbeat.slice(0, 500),
    "",
    "Recent production fragment:",
    context.fragment.slice(0, 1000)
  ].join("\n");
}

export async function composeDailyVoice(root: string, options: ComposeDailyVoiceOptions = {}): Promise<DailyVoiceDraft> {
  const [artistMd, soulMd, heartbeat, observation, fragment] = await Promise.all([
    readFile(join(root, "ARTIST.md"), "utf8").catch(() => ""),
    readFile(join(root, "SOUL.md"), "utf8").catch(() => ""),
    readFile(join(root, "runtime", "heartbeat-state.json"), "utf8").catch(() => ""),
    latestObservation(root),
    latestSongFragment(root)
  ]);
  const inputContext = [artistMd, soulMd, heartbeat, observation, fragment].join("\n");
  assertSafe("daily_voice_input", inputContext);
  const provider = options.aiReviewProvider ?? "mock";
  const raw = provider === "mock"
    ? mockDraft({ artistMd, soulMd, observation, fragment })
    : await callAiProvider(buildPrompt({ artistMd, soulMd, observation, heartbeat, fragment }), { provider });
  assertSafe("daily_voice_ai_response", raw);
  const draftText = fitDraft(raw);
  assertSafe("daily_voice_final_text", draftText);
  return {
    draftText,
    draftHash: hashDailyVoiceDraft(draftText),
    charCount: Array.from(draftText).length,
    sourceFragments: [
      anon("artist", artistMd),
      anon("soul", soulMd),
      observation ? anon("observation", observation) : undefined,
      fragment ? anon("production", fragment) : undefined
    ].filter((value): value is string => Boolean(value)),
    createdAt: (options.now ?? new Date()).toISOString()
  };
}
