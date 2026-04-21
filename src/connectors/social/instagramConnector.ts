import type { ConnectionStatus, SocialCapability, SocialPublishRequest, SocialPublishResult } from "../../types.js";
import type { SocialConnector } from "./SocialConnector.js";

const instagramCapabilities: SocialCapability = {
  textPost: false,
  imagePost: "unknown",
  videoPost: "unknown",
  carouselPost: "unknown",
  reelPost: "unknown",
  reply: false,
  quote: false,
  dm: false,
  scheduledPost: false,
  metrics: "unknown"
};

export class InstagramConnector implements SocialConnector {
  id = "instagram" as const;

  async checkConnection(): Promise<ConnectionStatus> {
    return { connected: false, reason: "oauth_not_connected" };
  }

  async checkCapabilities(): Promise<SocialCapability> {
    return instagramCapabilities;
  }

  async publish(input: SocialPublishRequest): Promise<SocialPublishResult> {
    return {
      accepted: false,
      platform: "instagram",
      dryRun: input.dryRun,
      reason: input.dryRun ? "dry-run blocks publish" : "Instagram connector is not enabled in this environment"
    };
  }
}
