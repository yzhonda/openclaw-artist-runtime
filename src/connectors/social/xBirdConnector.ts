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

export class XBirdConnector implements SocialConnector {
  id = "x" as const;

  async checkConnection(): Promise<ConnectionStatus> {
    return { connected: false, reason: "bird_not_checked" };
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
