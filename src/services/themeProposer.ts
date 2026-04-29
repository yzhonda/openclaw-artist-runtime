import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AiReviewProvider } from "../types.js";
import { callAiProvider } from "./aiProviderClient.js";
import { readArtistVoiceContext } from "./artistVoiceResponder.js";
import { secretLikePattern } from "./personaMigrator.js";

export interface ThemeProposalContext {
  observations?: string;
  aiReviewProvider?: AiReviewProvider;
}

export interface ThemeProposal {
  theme: string;
  reason: string;
  provider: AiReviewProvider | "mock" | "not_configured";
}

function truncate(value: string, maxLength: number): string {
  const trimmed = value.trim();
  return trimmed.length <= maxLength ? trimmed : `${trimmed.slice(0, maxLength - 3)}...`;
}

function parseTheme(raw: string): { theme: string; reason: string } {
  const theme = raw.match(/theme\s*:\s*(.+)/i)?.[1]?.trim();
  const reason = raw.match(/reason\s*:\s*(.+)/i)?.[1]?.trim();
  return {
    theme: theme || raw.split(/\r?\n/).find(Boolean)?.replace(/^[-*]\s*/, "").trim() || "signal in the ruins",
    reason: reason || "derived from current observations and artist context"
  };
}

function buildPrompt(artistMd: string, currentState: string, observations: string): string {
  return [
    "System: Propose one song theme for an autonomous public musical artist.",
    "Return exactly two lines: theme: <one concise theme>; reason: <why this fits>.",
    "Do not include secrets, credentials, cookies, or private config.",
    "",
    "ARTIST.md:",
    truncate(artistMd, 2400),
    "",
    "artist/CURRENT_STATE.md:",
    truncate(currentState, 1200),
    "",
    "X observations:",
    truncate(observations, 2400)
  ].join("\n");
}

export async function proposeTheme(root: string, context: ThemeProposalContext = {}): Promise<ThemeProposal> {
  const voiceContext = await readArtistVoiceContext(root);
  const observations = context.observations ?? await readFile(join(root, "observations"), "utf8").catch(() => "");
  if (secretLikePattern.test(observations)) {
    throw new Error("theme_context_contains_secret_like_text");
  }
  const provider = context.aiReviewProvider ?? "mock";
  const raw = provider === "mock"
    ? "theme: pressure building under public noise\nreason: mock provider derived the theme from observations"
    : await callAiProvider(buildPrompt(voiceContext.artistMd, voiceContext.currentState, observations), { provider });
  if (secretLikePattern.test(raw)) {
    throw new Error("theme_response_contains_secret_like_text");
  }
  const parsed = parseTheme(raw);
  return {
    ...parsed,
    provider: raw.includes("is not configured") ? "not_configured" : provider
  };
}
