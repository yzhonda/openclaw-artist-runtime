import type { SocialConnector } from "./SocialConnector.js";
import type { SocialCapability, SocialPublishRequest, SocialPublishResult } from "../../types/social.js";

export class TikTokConnector implements SocialConnector {
  id = "tiktok" as const;
  label = "TikTok";

  async checkConnection() {
    // TODO: OAuth token/account check.
    return { ok: false, message: "TikTok connector not implemented" };
  }

  async checkCapabilities(): Promise<SocialCapability> {
    return {
      textPost: false,
      imagePost: false,
      videoPost: true,
      carouselPost: false,
      reelPost: false,
      reply: false,
      quote: false,
      dm: false,
      scheduledPost: false,
      metrics: true,
    };
  }

  async publish(_input: SocialPublishRequest): Promise<SocialPublishResult> {
    return { ok: false, platform: "tiktok", error: "Not implemented", verified: false };
  }
}