import { spawn } from "node:child_process";
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

const BIRD_PROBE_TIMEOUT_MS = 750;

function runCommand(spawnImpl: SpawnImpl, command: string, args: string[]): Promise<CommandResult> {
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
      }, BIRD_PROBE_TIMEOUT_MS);

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

export class XBirdConnector implements SocialConnector {
  constructor(private readonly spawnImpl: SpawnImpl = spawn) {}

  id = "x" as const;

  async checkConnection(): Promise<ConnectionStatus> {
    const cliProbe = await runCommand(this.spawnImpl, "bird", ["--help"]);
    if (cliProbe.errorCode === "ENOENT") {
      return { connected: false, reason: "bird_cli_not_installed" };
    }

    const whoamiProbe = await runCommand(this.spawnImpl, "bird", ["whoami", "--plain"]);
    if (whoamiProbe.errorCode === "ENOENT") {
      return { connected: false, reason: "bird_cli_not_installed" };
    }

    const combinedOutput = [whoamiProbe.stdout, whoamiProbe.stderr].filter(Boolean).join("\n");
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
    return {
      accepted: false,
      platform: "x",
      dryRun: input.dryRun,
      reason: input.dryRun ? "dry-run blocks publish" : "Bird connector is not enabled in this environment"
    };
  }

  async reply(input: SocialPublishRequest): Promise<SocialPublishResult> {
    return {
      accepted: false,
      platform: "x",
      dryRun: input.dryRun,
      reason: input.dryRun ? "dry-run blocks reply" : "Bird reply is not enabled in this environment"
    };
  }
}
