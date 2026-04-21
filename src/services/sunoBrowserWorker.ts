import type { SunoWorkerState, SunoWorkerStatus } from "../types.js";

export class SunoBrowserWorker {
  private state: SunoWorkerState = "disconnected";
  private hardStopReason?: string;

  setState(state: SunoWorkerState, hardStopReason?: string): void {
    this.state = state;
    this.hardStopReason = hardStopReason;
  }

  pause(reason = "paused by operator"): void {
    this.state = "paused";
    this.hardStopReason = reason;
  }

  async status(): Promise<SunoWorkerStatus> {
    return {
      state: this.state,
      connected: this.state === "connected",
      hardStopReason: this.hardStopReason
    };
  }
}
