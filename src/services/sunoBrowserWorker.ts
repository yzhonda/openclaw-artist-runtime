import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SunoWorkerState, SunoWorkerStatus } from "../types.js";

export class SunoBrowserWorker {
  constructor(private readonly workspaceRoot = ".") {}

  private statePath(): string {
    return join(this.workspaceRoot, "runtime", "suno-worker.json");
  }

  private async readState(): Promise<SunoWorkerStatus> {
    const contents = await readFile(this.statePath(), "utf8").catch(() => "");
    if (!contents) {
      return {
        state: "disconnected",
        connected: false,
        lastTransitionAt: new Date().toISOString(),
        failureCount: 0
      };
    }
    return JSON.parse(contents) as SunoWorkerStatus;
  }

  private async writeState(next: SunoWorkerStatus): Promise<SunoWorkerStatus> {
    await mkdir(join(this.workspaceRoot, "runtime"), { recursive: true });
    await writeFile(this.statePath(), `${JSON.stringify(next, null, 2)}\n`, "utf8");
    return next;
  }

  async setState(state: SunoWorkerState, hardStopReason?: string, pendingAction?: string): Promise<SunoWorkerStatus> {
    const current = await this.readState();
    const next: SunoWorkerStatus = {
      ...current,
      state,
      connected: state === "connected",
      hardStopReason,
      pendingAction,
      lastTransitionAt: new Date().toISOString()
    };
    if (state === "login_challenge" || state === "captcha" || state === "payment_prompt" || state === "ui_mismatch" || state === "quota_exhausted") {
      next.failureCount = (current.failureCount ?? 0) + 1;
    }
    return this.writeState(next);
  }

  async pause(reason = "paused by operator"): Promise<SunoWorkerStatus> {
    return this.setState("paused", reason);
  }

  async connect(): Promise<SunoWorkerStatus> {
    return this.setState("disconnected", undefined, "operator_login_required");
  }

  async reconnect(): Promise<SunoWorkerStatus> {
    return this.setState("disconnected", undefined, "reconnect_requested");
  }

  async status(): Promise<SunoWorkerStatus> {
    return this.readState();
  }
}
