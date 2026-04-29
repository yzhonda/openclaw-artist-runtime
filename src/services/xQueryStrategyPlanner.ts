import type { AiReviewProvider } from "../types.js";
import { callAiProvider } from "./aiProviderClient.js";
import { secretLikePattern } from "./personaMigrator.js";

export interface XQueryStrategyInput {
  personaText?: string;
  observationHistory?: string;
  manualSeed?: { hint?: string };
  aiReviewProvider?: AiReviewProvider;
}

export interface XQueryStrategy {
  mode: "topical" | "evergreen";
  query: string;
  recencyWindow?: number;
}

function sanitizeQuery(value: string): string {
  return value.replace(/[^\p{L}\p{N}\s#_-]+/gu, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

function fromHint(hint: string): XQueryStrategy | undefined {
  if (/最新|ニュース|いま|今|today|news|current/i.test(hint)) {
    return { mode: "topical", query: sanitizeQuery(hint), recencyWindow: 24 };
  }
  if (/普遍|永遠|evergreen|timeless/i.test(hint)) {
    return { mode: "evergreen", query: sanitizeQuery(hint) };
  }
  return undefined;
}

function parseResponse(raw: string, fallbackQuery: string): XQueryStrategy {
  const mode = /evergreen/i.test(raw) ? "evergreen" : "topical";
  const query = sanitizeQuery(raw.match(/query\s*:\s*(.+)/i)?.[1] ?? fallbackQuery) || fallbackQuery;
  const hours = Number.parseInt(raw.match(/recency(?:Window)?\s*:\s*(\d+)/i)?.[1] ?? "", 10);
  return {
    mode,
    query,
    ...(mode === "topical" ? { recencyWindow: Number.isFinite(hours) ? hours : 24 } : {})
  };
}

export async function planQueryStrategy(input: XQueryStrategyInput = {}): Promise<XQueryStrategy> {
  const combined = `${input.observationHistory ?? ""}\n${input.manualSeed?.hint ?? ""}`;
  if (secretLikePattern.test(combined)) {
    throw new Error("x_query_strategy_contains_secret_like_text");
  }
  const hint = input.manualSeed?.hint?.trim() ?? "";
  const hinted = hint ? fromHint(hint) : undefined;
  if (hinted) {
    return hinted;
  }
  const fallbackQuery = sanitizeQuery(hint || input.personaText || "music society culture") || "music society culture";
  const provider = input.aiReviewProvider ?? "mock";
  if (provider === "mock") {
    return { mode: "topical", query: fallbackQuery, recencyWindow: 24 };
  }
  const raw = await callAiProvider([
    "System: Choose a safe X/Twitter observation query strategy for an autonomous musical artist.",
    "Return mode: topical|evergreen, query: <short query>, recency: <hours for topical>.",
    "Avoid high-frequency polling and avoid secrets.",
    `Producer hint: ${hint || "(none)"}`,
    `Persona: ${(input.personaText ?? "").slice(0, 1600)}`,
    `Recent observations: ${(input.observationHistory ?? "").slice(0, 1600)}`
  ].join("\n"), { provider });
  if (secretLikePattern.test(raw)) {
    throw new Error("x_query_strategy_response_contains_secret_like_text");
  }
  return parseResponse(raw, fallbackQuery);
}
