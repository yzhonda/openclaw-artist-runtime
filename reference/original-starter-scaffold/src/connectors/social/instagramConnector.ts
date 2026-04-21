import type { SocialConnector } from "./SocialConnector.js";
import type { SocialCapability, SocialPublishRequest, SocialPublishResult } from "../../types/social.js";

export class InstagramConnector implements SocialConnector {
  id = "instagram" as const;
  label = "Instagram";

  async checkConnection() {
    // TODO: OAuth token/account check.
    return { ok: false, message: "Instagram connector not implemented" };
  }

  async checkCapabilities(): Promise<SocialCapability> {
    // TODO: actual capability check after connection.
    return {
      textPost: false,
      imagePost: true,
      videoPost: true,
      carouselPost: true,
      reelPost: "unknown",
      reply: false,
      quote: false,
      dm: false,
      scheduledPost: false,
      metrics: true,
    };
  }

  async publish(_input: SocialPublishRequest): Promise<SocialPublishResult> {
    return { ok: false, platform: "instagram", error: "Not implemented", verified: false };
  }
}