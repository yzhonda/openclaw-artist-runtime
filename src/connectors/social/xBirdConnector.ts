import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import type { ConnectionStatus, SocialCapability, SocialPublishRequest, SocialPublishResult } from "../../types.js";
import type { SocialConnector } from "./SocialConnector.js";

const xCapabilities: SocialCapability = {
  textPost: true,
  imagePost: "unknown",
  videoPost: "unknown",
  carouselPost: false,
  reelPost: false,
  reply: true,
  quote: "unknown",
  dm: false,
  scheduledPost: false,
  metrics: "unknown"
};

interface SpawnStreams {
  stdout?: EventEmitter;
  stderr?: EventEmitter;
}

interface SpawnedProcess extends EventEmitter, SpawnStreams {}

type SpawnImpl = typeof spawn;

interface CommandResult {
  code: number | null;
  stdout: string;
  stderr: string;
  errorCode?: string;
}

interface PublishRecord {
  textHash: string;
  publishedAtMs: number;
}

interface PublishGuardState {
  recentPublishes: PublishRecord[];
}

interface XBirdConnectorOptions {
  now?: () => number;
  publishGuardState?: PublishGuardState;
  minPublishIntervalMs?: number;
  dedupeHistoryLimit?: number;
}

const DEFAULT_PUBLISH_GUARD_STATE: PublishGuardState = {
  recentPublishes: []
};

const BIRD_PROBE_TIMEOUT_MS = 750;
const BIRD_PUBLISH_TIMEOUT_MS = 3000;
const DEFAULT_MIN_PUBLISH_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_DEDUPE_HISTORY_LIMIT = 10;

function runCommand(spawnImpl: SpawnImpl, command: string, args: string[], timeoutMs: number): Promise<CommandResult> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timeoutHandle: NodeJS.Timeout | undefined;

    const finish = (result: CommandResult) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      resolve({
        ...result,
        stdout: result.stdout.trim(),
        stderr: result.stderr.trim()
      });
    };

    try {
      const child = spawnImpl(command, args, {
        stdio: ["ignore", "pipe", "pipe"]
      }) as SpawnedProcess;

      timeoutHandle = setTimeout(() => {
        if ("kill" in child && typeof child.kill === "function") {
          child.kill("SIGTERM");
        }
        finish({
          code: null,
          stdout,
          stderr,
          errorCode: "ETIMEDOUT"
        });
      }, timeoutMs);

      child.stdout?.on("data", (chunk: Buffer | string) => {
        stdout += chunk.toString();
      });
      child.stderr?.on("data", (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });
      child.once("error", (error: NodeJS.ErrnoException) => {
        finish({
          code: null,
          stdout,
          stderr,
          errorCode: error.code
        });
      });
      child.once("close", (code: number | null) => {
        finish({
          code,
          stdout,
          stderr
        });
      });
    } catch (error) {
      finish({
        code: null,
        stdout,
        stderr,
        errorCode: error instanceof Error && "code" in error ? String((error as NodeJS.ErrnoException).code) : undefined
      });
    }
  });
}

function extractAccountLabel(output: string): string | undefined {
  const firstLine = output
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine || undefined;
}

function looksLikeAuthFailure(output: string): boolean {
  return /(401|unauthorized|could not authenticate|auth[_ ]token|expired)/i.test(output);
}

function looksLikeRateLimitFailure(output: string): boolean {
  return /(429|rate limit|too many requests|spam|temporarily locked)/i.test(output);
}

function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function parseTweetUrl(output: string): string | undefined {
  const match = output.match(/https:\/\/(?:x|twitter)\.com\/[^\s/]+\/status\/(\d+)/i);
  return match?.[0];
}

function parseTweetId(output: string): string | undefined {
  const fromUrl = parseTweetUrl(output)?.match(/status\/(\d+)/i)?.[1];
  if (fromUrl) {
    return fromUrl;
  }
  const fromKeyValue = output.match(/tweet_id\s*[:=]\s*(\d+)/i)?.[1];
  if (fromKeyValue) {
    return fromKeyValue;
  }
  const fromBareId = output.match(/\bstatus\/(\d+)\b/i)?.[1];
  return fromBareId;
}

function buildCombinedOutput(result: CommandResult): string {
  return [result.stdout, result.stderr].filter(Boolean).join("\n");
}

function resolveRecentPublishes(state: PublishGuardState, limit: number): PublishRecord[] {
  return state.recentPublishes.slice(-limit);
}

function checkPublishGuards(
  recentPublishes: PublishRecord[],
  textDigest: string,
  nowMs: number,
  minPublishIntervalMs: number
): SocialPublishResult | undefined {
  const duplicate = recentPublishes.some((entry) => entry.textHash === textDigest);
  if (duplicate) {
    return {
      accepted: false,
      platform: "x",
      dryRun: false,
      reason: "bird_duplicate_text_blocked"
    };
  }

  const latestPublish = recentPublishes.at(-1);
  if (latestPublish && nowMs - latestPublish.publishedAtMs < minPublishIntervalMs) {
    return {
      accepted: false,
      platform: "x",
      dryRun: false,
      reason: "bird_min_interval_blocked"
    };
  }

  return undefined;
}

function buildPublishFailure(result: CommandResult): SocialPublishResult {
  const combinedOutput = buildCombinedOutput(result);
  if (result.errorCode === "ENOENT") {
    return {
      accepted: false,
      platform: "x",
      dryRun: false,
      reason: "bird_cli_not_installed"
    };
  }

  if (looksLikeAuthFailure(combinedOutput)) {
    return {
      accepted: false,
      platform: "x",
      dryRun: false,
      reason: "bird_auth_expired"
    };
  }

  if (looksLikeRateLimitFailure(combinedOutput)) {
    return {
      accepted: false,
      platform: "x",
      dryRun: false,
      reason: "bird_rate_limited"
    };
  }

  return {
    accepted: false,
    platform: "x",
    dryRun: false,
    reason: "bird_publish_failed"
  };
}

function resolveReplyTarget(input: SocialPublishRequest): string | undefined {
  const targetUrl = input.targetUrl?.trim();
  if (targetUrl) {
    return targetUrl;
  }
  const targetId = input.targetId?.trim();
  if (targetId) {
    return targetId;
  }
  return undefined;
}

export class XBirdConnector implements SocialConnector {
  private readonly now: () => number;
  private readonly publishGuardState: PublishGuardState;
  private readonly minPublishIntervalMs: number;
  private readonly dedupeHistoryLimit: number;

  constructor(private readonly spawnImpl: SpawnImpl = spawn, options: XBirdConnectorOptions = {}) {
    this.now = options.now ?? Date.now;
    this.publishGuardState = options.publishGuardState ?? DEFAULT_PUBLISH_GUARD_STATE;
    this.minPublishIntervalMs = options.minPublishIntervalMs ?? DEFAULT_MIN_PUBLISH_INTERVAL_MS;
    this.dedupeHistoryLimit = options.dedupeHistoryLimit ?? DEFAULT_DEDUPE_HISTORY_LIMIT;
  }

  id = "x" as const;

  async checkConnection(): Promise<ConnectionStatus> {
    const cliProbe = await runCommand(this.spawnImpl, "bird", ["--help"], BIRD_PROBE_TIMEOUT_MS);
    if (cliProbe.errorCode === "ENOENT") {
      return { connected: false, reason: "bird_cli_not_installed" };
    }

    const whoamiProbe = await runCommand(this.spawnImpl, "bird", ["whoami", "--plain"], BIRD_PROBE_TIMEOUT_MS);
    if (whoamiProbe.errorCode === "ENOENT") {
      return { connected: false, reason: "bird_cli_not_installed" };
    }

    const combinedOutput = buildCombinedOutput(whoamiProbe);
    if (whoamiProbe.code === 0) {
      return {
        connected: true,
        accountLabel: extractAccountLabel(combinedOutput)
      };
    }

    if (looksLikeAuthFailure(combinedOutput)) {
      return {
        connected: false,
        reason: "bird_auth_expired"
      };
    }

    return {
      connected: false,
      reason: "bird_probe_failed"
    };
  }

  async checkCapabilities(): Promise<SocialCapability> {
    return xCapabilities;
  }

  async publish(input: SocialPublishRequest): Promise<SocialPublishResult> {
    if (input.dryRun) {
      return {
        accepted: false,
        platform: "x",
        dryRun: true,
        reason: "dry-run blocks publish"
      };
    }

    if (input.mediaPaths?.length) {
      return {
        accepted: false,
        platform: "x",
        dryRun: false,
        reason: "bird_text_only_publish_only"
      };
    }

    const text = input.text?.trim() ?? "";
    if (!text) {
      return {
        accepted: false,
        platform: "x",
        dryRun: false,
        reason: "bird_text_required"
      };
    }

    const nowMs = this.now();
    const textDigest = hashText(text);
    const recentPublishes = resolveRecentPublishes(this.publishGuardState, this.dedupeHistoryLimit);
    const guardFailure = checkPublishGuards(recentPublishes, textDigest, nowMs, this.minPublishIntervalMs);
    if (guardFailure) {
      return guardFailure;
    }

    const publishResult = await runCommand(this.spawnImpl, "bird", ["--plain", "tweet", text], BIRD_PUBLISH_TIMEOUT_MS);
    const combinedOutput = buildCombinedOutput(publishResult);

    if (publishResult.code === 0) {
      this.publishGuardState.recentPublishes = [...recentPublishes, { textHash: textDigest, publishedAtMs: nowMs }].slice(-this.dedupeHistoryLimit);
      return {
        accepted: true,
        platform: "x",
        dryRun: false,
        reason: "bird_publish_ok",
        id: parseTweetId(combinedOutput),
        url: parseTweetUrl(combinedOutput),
        raw: combinedOutput || undefined
      };
    }

    return buildPublishFailure(publishResult);
  }

  async reply(input: SocialPublishRequest): Promise<SocialPublishResult> {
    if (input.dryRun) {
      return {
        accepted: false,
        platform: "x",
        dryRun: true,
        reason: "dry-run blocks reply"
      };
    }

    if (input.mediaPaths?.length) {
      return {
        accepted: false,
        platform: "x",
        dryRun: false,
        reason: "bird_text_only_reply_only"
      };
    }

    const text = input.text?.trim() ?? "";
    if (!text) {
      return {
        accepted: false,
        platform: "x",
        dryRun: false,
        reason: "bird_text_required"
      };
    }

    const target = resolveReplyTarget(input);
    if (!target) {
      return {
        accepted: false,
        platform: "x",
        dryRun: false,
        reason: "bird_reply_target_required"
      };
    }

    const nowMs = this.now();
    const textDigest = hashText(text);
    const recentPublishes = resolveRecentPublishes(this.publishGuardState, this.dedupeHistoryLimit);
    const guardFailure = checkPublishGuards(recentPublishes, textDigest, nowMs, this.minPublishIntervalMs);
    if (guardFailure) {
      return guardFailure;
    }

    const replyResult = await runCommand(this.spawnImpl, "bird", ["--plain", "reply", target, text], BIRD_PUBLISH_TIMEOUT_MS);
    const combinedOutput = buildCombinedOutput(replyResult);
    if (replyResult.code === 0) {
      this.publishGuardState.recentPublishes = [...recentPublishes, { textHash: textDigest, publishedAtMs: nowMs }].slice(-this.dedupeHistoryLimit);
      return {
        accepted: true,
        platform: "x",
        dryRun: false,
        reason: "bird_reply_ok",
        id: parseTweetId(combinedOutput),
        url: parseTweetUrl(combinedOutput),
        raw: combinedOutput || undefined
      };
    }

    const failure = buildPublishFailure(replyResult);
    return {
      ...failure,
      reason: failure.reason === "bird_publish_failed" ? "bird_reply_failed" : failure.reason
    };
  }
}
