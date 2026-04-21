import type { AutopilotStage, AutopilotStatus } from "../types.js";

export interface AutopilotTickInput {
  enabled: boolean;
  dryRun: boolean;
  paused?: boolean;
  hardStop?: boolean;
  promptPackReady?: boolean;
  takeSelected?: boolean;
  assetsReady?: boolean;
}

export class ArtistAutopilotService {
  private stage: AutopilotStage = "idle";

  planNextStage(input: AutopilotTickInput): AutopilotStage {
    if (!input.enabled) {
      return "idle";
    }
    if (input.paused) {
      return "paused";
    }
    if (input.hardStop) {
      return "failed_closed";
    }
    if (!input.promptPackReady) {
      return "prompt_pack";
    }
    if (!input.takeSelected) {
      return "take_selection";
    }
    if (!input.assetsReady) {
      return "asset_generation";
    }
    return "publishing";
  }

  async tick(input: AutopilotTickInput): Promise<AutopilotStatus> {
    this.stage = this.planNextStage(input);
    return this.status(input.enabled, input.dryRun);
  }

  status(enabled = false, dryRun = true): AutopilotStatus {
    return {
      enabled,
      dryRun,
      stage: this.stage,
      nextAction: stageToNextAction(this.stage)
    };
  }
}

function stageToNextAction(stage: AutopilotStage): string {
  switch (stage) {
    case "prompt_pack":
      return "create_or_validate_prompt_pack";
    case "take_selection":
      return "evaluate_and_select_take";
    case "asset_generation":
      return "create_social_assets";
    case "publishing":
      return "publish_distribution_set";
    case "paused":
      return "await_manual_resume";
    case "failed_closed":
      return "surface_alert";
    default:
      return "idle";
  }
}
