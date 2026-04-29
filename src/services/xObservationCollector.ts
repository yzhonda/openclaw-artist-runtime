import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { isBirdBanIndication, recordBirdCall, triggerCooldown, tryAcquireBirdCall } from "./birdRateLimiter.js";
import { emitRuntimeEvent } from "./runtimeEventBus.js";
import { secretLikePattern } from "./personaMigrator.js";

export interface XObservationContext {
  personaText?: string;
  query?: string;
  now?: Date;
  runner?: () => Promise<{ stdout: string; stderr?: string }>;
}

export interface XObservationResult {
  status: "collected" | "cached" | "skipped" | "cooldown";
  path: string;
  observations: string;
  reason?: string;
}

function jstDate(now = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function observationPath(root: string, now = new Date()): string {
  return join(root, "observations", `${jstDate(now)}.md`);
}

function defaultRunner(query?: string): () => Promise<{ stdout: string; stderr?: string }> {
  return async () => {
    const args = query ? ["search", query, "--plain"] : ["timeline", "--plain"];
    const { execFile } = await import("node:child_process");
    return new Promise((resolve, reject) => {
      execFile("bird", args, { timeout: 30_000, maxBuffer: 512 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({ stdout, stderr });
      });
    });
  };
}

function filterObservationLines(source: string, personaText?: string): string[] {
  const personaWords = new Set(
    (personaText ?? "")
      .toLowerCase()
      .split(/[^a-z0-9一-龠ぁ-んァ-ヶー]+/i)
      .filter((word) => word.length >= 3)
      .slice(0, 80)
  );
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (personaWords.size === 0) {
    return lines.slice(0, 12);
  }
  const matched = lines.filter((line) => {
    const lower = line.toLowerCase();
    return [...personaWords].some((word) => lower.includes(word));
  });
  return (matched.length > 0 ? matched : lines).slice(0, 12);
}

function renderObservation(lines: string[], now: Date, query?: string): string {
  return [
    `# X Observations ${jstDate(now)}`,
    "",
    query ? `Query: ${query}` : "Source: timeline",
    "",
    ...lines.map((line) => `- ${line}`)
  ].join("\n");
}

export async function readTodayObservations(root: string, now = new Date()): Promise<string> {
  return readFile(observationPath(root, now), "utf8").catch(() => "");
}

export async function collectObservations(root: string, context: XObservationContext = {}): Promise<XObservationResult> {
  const now = context.now ?? new Date();
  const path = observationPath(root, now);
  const cached = await readFile(path, "utf8").catch(() => "");
  if (cached) {
    return { status: "cached", path, observations: cached };
  }
  const gate = await tryAcquireBirdCall(root, now);
  if (!gate.allowed) {
    const status = gate.cooldownUntil ? "cooldown" : "skipped";
    return { status, path, observations: "", reason: gate.reason };
  }
  const runner = context.runner ?? defaultRunner(context.query);
  try {
    const result = await runner();
    const combined = `${result.stdout}\n${result.stderr ?? ""}`;
    if (isBirdBanIndication(combined)) {
      await recordBirdCall(root, now);
      await triggerCooldown(root, combined.slice(0, 240), now);
      emitRuntimeEvent({
        type: "bird_cooldown_triggered",
        reason: "bird returned a rate-limit or ban indication",
        cooldownUntil: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        timestamp: now.getTime()
      });
      return { status: "cooldown", path, observations: "", reason: "bird returned a rate-limit or ban indication" };
    }
    if (secretLikePattern.test(result.stdout)) {
      throw new Error("x_observation_contains_secret_like_text");
    }
    await recordBirdCall(root, now);
    const observations = renderObservation(filterObservationLines(result.stdout, context.personaText), now, context.query);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${observations.trim()}\n`, "utf8");
    return { status: "collected", path, observations };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordBirdCall(root, now);
    if (isBirdBanIndication(message)) {
      await triggerCooldown(root, message, now);
      emitRuntimeEvent({
        type: "bird_cooldown_triggered",
        reason: message,
        cooldownUntil: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        timestamp: now.getTime()
      });
      return { status: "cooldown", path, observations: "", reason: message };
    }
    return { status: "skipped", path, observations: "", reason: message };
  }
}
