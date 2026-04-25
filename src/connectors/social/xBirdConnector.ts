import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import type { ConnectionStatus, SocialCapability, SocialPublishRequest, SocialPublishResult } from "../../types.js";
import type { SocialConnector } from "./SocialConnector.js";
import { resolveReplyTarget, type ReplyTargetFetch } from "./resolveReplyTarget.js";

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
  dryRunStageExecution?: boolean;
  replyTargetFetchImpl?: ReplyTargetFetch;
}

const DEFAULT_PUBLISH_GUARD_STATE: PublishGuardState = {
  recentPublishes: []
};

const BIRD_PROBE_TIMEOUT_MS = 3000;
const BIRD_PUBLISH_TIMEOUT_MS = 3000;
const DEFAULT_MIN_PUBLISH_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_DEDUPE_HISTORY_LIMIT = 10;
const DRY_RUN_BLOCK_REASON = "dry-run blocks publish";
const DRY_RUN_REPLY_BLOCK_REASON = "dry-run blocks reply";
const LIVE_GO_BLOCK_REASON = "requires_explicit_live_go";

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

function buildBirdArgs(args: string[]): string[] {
  const firefoxProfile = process.env.OPENCLAW_X_FIREFOX_PROFILE?.trim();
  return firefoxProfile ? ["--firefox-profile", firefoxProfile, ...args] : args;
}

export class XBirdConnector implements SocialConnector {
  private readonly now: () => number;
  private readonly publishGuardState: PublishGuardState;
  private readonly minPublishIntervalMs: number;
  private readonly dedupeHistoryLimit: number;
  private readonly dryRunStageExecution: boolean;
  private readonly replyTargetFetchImpl?: ReplyTargetFetch;

  constructor(private readonly spawnImpl: SpawnImpl = spawn, options: XBirdConnectorOptions = {}) {
    this.now = options.now ?? Date.now;
    this.publishGuardState = options.publishGuardState ?? DEFAULT_PUBLISH_GUARD_STATE;
    this.minPublishIntervalMs = options.minPublishIntervalMs ?? DEFAULT_MIN_PUBLISH_INTERVAL_MS;
    this.dedupeHistoryLimit = options.dedupeHistoryLimit ?? DEFAULT_DEDUPE_HISTORY_LIMIT;
    this.dryRunStageExecution = options.dryRunStageExecution ?? false;
    this.replyTargetFetchImpl = options.replyTargetFetchImpl;
  }

  id = "x" as const;

  async checkConnection(): Promise<ConnectionStatus> {
    const cliProbe = await runCommand(this.spawnImpl, "bird", ["--help"], BIRD_PROBE_TIMEOUT_MS);
    if (cliProbe.errorCode === "ENOENT") {
      return { connected: false, reason: "bird_cli_not_installed" };
    }

    const whoamiProbe = await runCommand(this.spawnImpl, "bird", buildBirdArgs(["whoami", "--plain"]), BIRD_PROBE_TIMEOUT_MS);
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
      if (this.dryRunStageExecution) {
        return this.publishDryRunStages(input);
      }
      return {
        accepted: false,
        platform: "x",
        dryRun: true,
        reason: DRY_RUN_BLOCK_REASON
      };
    }

    return {
      accepted: false,
      platform: "x",
      dryRun: false,
      reason: LIVE_GO_BLOCK_REASON
    };
  }

  async reply(input: SocialPublishRequest): Promise<SocialPublishResult> {
    if (input.dryRun) {
      const resolvedTarget = await resolveReplyTarget(input, { fetchImpl: this.replyTargetFetchImpl });
      if (!resolvedTarget.ok) {
        return {
          accepted: false,
          platform: "x",
          dryRun: true,
          reason: DRY_RUN_REPLY_BLOCK_REASON,
          raw: {
            type: "reply",
            resolvedFrom: resolvedTarget.resolvedFrom,
            resolutionReason: resolvedTarget.reason,
            dryRun: true,
            timestamp: new Date(this.now()).toISOString()
          }
        };
      }
      return {
        accepted: false,
        platform: "x",
        dryRun: true,
        reason: DRY_RUN_REPLY_BLOCK_REASON,
        raw: {
          type: "reply",
          targetId: resolvedTarget.targetId,
          resolvedFrom: resolvedTarget.resolvedFrom,
          dryRun: true,
          timestamp: new Date(this.now()).toISOString()
        }
      };
    }

    return {
      accepted: false,
      platform: "x",
      dryRun: false,
      reason: LIVE_GO_BLOCK_REASON
    };
  }

  private async publishDryRunStages(input: SocialPublishRequest): Promise<SocialPublishResult> {
    const text = input.text?.trim() ?? "";
    if (!text) {
      return {
        accepted: false,
        platform: "x",
        dryRun: true,
        reason: "bird_text_required"
      };
    }

    const authCheck = await runCommand(this.spawnImpl, "bird", buildBirdArgs(["whoami", "--plain"]), BIRD_PROBE_TIMEOUT_MS);
    if (authCheck.errorCode === "ENOENT") {
      return {
        accepted: false,
        platform: "x",
        dryRun: true,
        reason: "bird_cli_not_installed"
      };
    }
    const authOutput = buildCombinedOutput(authCheck);
    if (authCheck.code !== 0) {
      return {
        accepted: false,
        platform: "x",
        dryRun: true,
        reason: looksLikeAuthFailure(authOutput) ? "bird_auth_expired" : "bird_probe_failed"
      };
    }

    const compose = await runCommand(this.spawnImpl, "bird", buildBirdArgs(["--plain", "compose", text]), BIRD_PUBLISH_TIMEOUT_MS);
    if (compose.code !== 0) {
      return {
        accepted: false,
        platform: "x",
        dryRun: true,
        reason: "bird_compose_failed"
      };
    }

    const submit = await runCommand(this.spawnImpl, "bird", buildBirdArgs(["--plain", "tweet", "--dry-run", text]), BIRD_PUBLISH_TIMEOUT_MS);
    if (submit.code !== 0) {
      const submitOutput = buildCombinedOutput(submit);
      return {
        accepted: false,
        platform: "x",
        dryRun: true,
        reason: looksLikeRateLimitFailure(submitOutput) ? "bird_rate_limited" : "bird_dry_run_submit_failed"
      };
    }

    return {
      accepted: false,
      platform: "x",
      dryRun: true,
      reason: DRY_RUN_BLOCK_REASON,
      raw: {
        accountLabel: extractAccountLabel(authOutput),
        stageOrder: ["auth_check", "compose", "submit"],
        submitPreview: buildCombinedOutput(submit) || undefined
      }
    };
  }
}
