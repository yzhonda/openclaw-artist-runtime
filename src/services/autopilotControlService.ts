import type { AutopilotRunState } from "../types.js";
import {
  backupAutopilotState,
  buildResetAutopilotState,
  readAutopilotState,
  type AutopilotRecoveryClock,
  writeAutopilotState
} from "./autopilotRecovery.js";

export interface AutopilotResumeOptions {
  resetState?: boolean;
  reason?: string;
  source?: "operator" | "telegram" | "test";
}

export class AutopilotControlService {
  constructor(private readonly clock?: AutopilotRecoveryClock) {}

  async pause(root: string, reason = "paused by operator"): Promise<AutopilotRunState> {
    const current = await readAutopilotState(root);
    return writeAutopilotState(root, {
      ...current,
      paused: true,
      pausedReason: reason,
      stage: "paused"
    });
  }

  async resume(root: string, options: AutopilotResumeOptions = {}): Promise<AutopilotRunState> {
    if (options.resetState) {
      await this.backupState(root);
      return writeAutopilotState(root, buildResetAutopilotState(this.clock));
    }

    const current = await readAutopilotState(root);
    return writeAutopilotState(root, {
      ...current,
      paused: false,
      pausedReason: undefined,
      hardStopReason: undefined,
      stage: "idle"
    });
  }

  async backupState(root: string): Promise<{ backupPath?: string }> {
    return backupAutopilotState(root, this.clock);
  }
}
