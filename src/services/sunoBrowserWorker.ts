import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SunoLoginHandoff, SunoWorkerState, SunoWorkerStatus } from "../types.js";

type SunoWorkerProbeState = Extract<
  SunoWorkerState,
  "connected" | "login_required" | "login_challenge" | "captcha" | "payment_prompt" | "ui_mismatch" | "quota_exhausted" | "disconnected"
>;

export interface SunoBrowserDriverProbe {
  state: SunoWorkerProbeState;
  detail?: string;
}

export interface SunoBrowserDriver {
  probe(): Promise<SunoBrowserDriverProbe>;
  stop?(): Promise<void>;
}

interface StartOptions {
  driver?: SunoBrowserDriver;
  requestedAction?: "operator_login_required" | "reconnect_requested";
}

function now(): string {
  return new Date().toISOString();
}

function isHardStopState(state: SunoWorkerState): state is Extract<SunoWorkerState, "login_challenge" | "captcha" | "payment_prompt" | "ui_mismatch" | "quota_exhausted"> {
  return state === "login_challenge" || state === "captcha" || state === "payment_prompt" || state === "ui_mismatch" || state === "quota_exhausted";
}

function buildHandoffReason(
  state: SunoWorkerProbeState,
  requestedAction: StartOptions["requestedAction"]
): SunoLoginHandoff["reason"] {
  if (state === "login_required") {
    return requestedAction ?? "operator_login_required";
  }
  return state === "login_challenge" || state === "captcha" || state === "payment_prompt"
    ? state
    : "operator_login_required";
}

function buildHandoffMessage(state: SunoWorkerProbeState, detail?: string): string {
  if (detail) {
    return detail;
  }

  switch (state) {
    case "login_required":
      return "Suno login required. Operator must complete login in the dedicated browser session.";
    case "login_challenge":
      return "Suno login challenge detected. Operator must complete the challenge before automation resumes.";
    case "captcha":
      return "Suno CAPTCHA detected. Operator must resolve it manually before automation resumes.";
    case "payment_prompt":
      return "Suno payment or credit prompt detected. Operator review is required before automation resumes.";
    case "ui_mismatch":
      return "Suno UI mismatch detected. Automation is paused until the worker contract is updated.";
    case "quota_exhausted":
      return "Suno quota appears exhausted. Automation is paused until budget is available again.";
    default:
      return "Suno worker needs operator attention.";
  }
}

export class SunoBrowserWorker {
  constructor(private readonly workspaceRoot = ".") {}

  private statePath(): string {
    return join(this.workspaceRoot, "runtime", "suno-worker.json");
  }

  private defaultState(): SunoWorkerStatus {
    return {
      state: "disconnected",
      connected: false,
      lastTransitionAt: now(),
      failureCount: 0
    };
  }

  private async readState(): Promise<SunoWorkerStatus> {
    const contents = await readFile(this.statePath(), "utf8").catch(() => "");
    if (!contents) {
      return this.defaultState();
    }
    return JSON.parse(contents) as SunoWorkerStatus;
  }

  private async writeState(next: SunoWorkerStatus): Promise<SunoWorkerStatus> {
    await mkdir(join(this.workspaceRoot, "runtime"), { recursive: true });
    await writeFile(this.statePath(), `${JSON.stringify(next, null, 2)}\n`, "utf8");
    return next;
  }

  private async transition(next: Partial<SunoWorkerStatus>): Promise<SunoWorkerStatus> {
    const current = await this.readState();
    const resolved: SunoWorkerStatus = {
      ...current,
      ...next,
      state: next.state ?? current.state,
      connected: next.connected ?? (next.state ? next.state === "connected" : current.connected),
      lastTransitionAt: now()
    };
    if (resolved.failureCount === undefined) {
      resolved.failureCount = current.failureCount ?? 0;
    }
    return this.writeState(resolved);
  }

  private async requireOperatorBridge(
    state: Extract<SunoWorkerProbeState, "login_required" | "login_challenge" | "captcha" | "payment_prompt">,
    requestedAction?: StartOptions["requestedAction"],
    detail?: string
  ): Promise<SunoWorkerStatus> {
    const current = await this.readState();
    const message = buildHandoffMessage(state, detail);
    const handoffReason = buildHandoffReason(state, requestedAction);
    const loginHandoff: SunoLoginHandoff = {
      state: "waiting_for_operator",
      reason: handoffReason,
      message,
      requestedAt: now()
    };
    return this.writeState({
      ...current,
      state,
      connected: false,
      pendingAction: requestedAction ?? "operator_login_required",
      hardStopReason: message,
      failureCount: isHardStopState(state) ? (current.failureCount ?? 0) + 1 : current.failureCount ?? 0,
      lastTransitionAt: now(),
      loginHandoff
    });
  }

  async start(options: StartOptions = {}): Promise<SunoWorkerStatus> {
    await this.transition({
      state: "connecting",
      connected: false,
      pendingAction: options.requestedAction ?? "operator_login_required",
      hardStopReason: undefined
    });

    const probe = options.driver
      ? await options.driver.probe()
      : { state: "login_required", detail: undefined } satisfies SunoBrowserDriverProbe;

    if (probe.state === "connected") {
      return this.transition({
        state: "connected",
        connected: true,
        pendingAction: undefined,
        hardStopReason: undefined,
        loginHandoff: undefined
      });
    }

    if (probe.state === "login_required" || probe.state === "login_challenge" || probe.state === "captcha" || probe.state === "payment_prompt") {
      return this.requireOperatorBridge(probe.state, options.requestedAction, probe.detail);
    }

    const message = buildHandoffMessage(probe.state, probe.detail);
    const current = await this.readState();
    return this.writeState({
      ...current,
      state: probe.state,
      connected: false,
      pendingAction: options.requestedAction,
      hardStopReason: isHardStopState(probe.state) ? message : undefined,
      failureCount: isHardStopState(probe.state) ? (current.failureCount ?? 0) + 1 : current.failureCount ?? 0,
      lastTransitionAt: now(),
      loginHandoff: undefined
    });
  }

  async setState(state: SunoWorkerState, hardStopReason?: string, pendingAction?: string): Promise<SunoWorkerStatus> {
    const current = await this.readState();
    const next: SunoWorkerStatus = {
      ...current,
      state,
      connected: state === "connected",
      hardStopReason,
      pendingAction,
      lastTransitionAt: now()
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

  async completeManualLoginHandoff(): Promise<SunoWorkerStatus> {
    const current = await this.readState();
    const nextHandoff = current.loginHandoff
      ? {
          ...current.loginHandoff,
          state: "completed" as const,
          completedAt: now()
        }
      : undefined;
    return this.writeState({
      ...current,
      state: "connected",
      connected: true,
      hardStopReason: undefined,
      pendingAction: undefined,
      lastTransitionAt: now(),
      loginHandoff: nextHandoff
    });
  }

  async stop(driver?: SunoBrowserDriver): Promise<SunoWorkerStatus> {
    const current = await this.readState();
    if (current.state === "stopped") {
      return current;
    }
    await driver?.stop?.().catch(() => undefined);
    return this.writeState({
      ...current,
      state: "stopped",
      connected: false,
      pendingAction: undefined,
      lastTransitionAt: now()
    });
  }

  async status(): Promise<SunoWorkerStatus> {
    return this.readState();
  }
}
