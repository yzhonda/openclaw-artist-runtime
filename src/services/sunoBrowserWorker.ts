import type { SunoWorkerState, SunoWorkerStatus } from "../types.js";

export class SunoBrowserWorker {
  private state: SunoWorkerState = "disconnected";
  private hardStopReason?: string;
  private lastTransitionAt = new Date().toISOString();
  private failureCount = 0;

  setState(state: SunoWorkerState, hardStopReason?: string): void {
    this.state = state;
    this.hardStopReason = hardStopReason;
    this.lastTransitionAt = new Date().toISOString();
    if (state === "login_challenge" || state === "captcha" || state === "payment_prompt" || state === "ui_mismatch" || state === "quota_exhausted") {
      this.failureCount += 1;
    }
  }

  pause(reason = "paused by operator"): void {
    this.state = "paused";
    this.hardStopReason = reason;
    this.lastTransitionAt = new Date().toISOString();
  }

  async status(): Promise<SunoWorkerStatus> {
    return {
      state: this.state,
      connected: this.state === "connected",
      hardStopReason: this.hardStopReason,
      lastTransitionAt: this.lastTransitionAt,
      failureCount: this.failureCount
    };
  }
}
