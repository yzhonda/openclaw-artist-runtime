import type { ConnectionStatus, SocialCapability, SocialPublishRequest, SocialPublishResult } from "../../types.js";
import type { SocialConnector } from "./SocialConnector.js";

const tiktokCapabilities: SocialCapability = {
  textPost: false,
  imagePost: false,
  videoPost: "unknown",
  carouselPost: false,
  reelPost: false,
  reply: false,
  quote: false,
  dm: false,
  scheduledPost: false,
  metrics: "unknown"
};

const TIKTOK_AUTH_ENV_VARS = [
  "OPENCLAW_TIKTOK_AUTH",
  "OPENCLAW_TIKTOK_ACCESS_TOKEN"
] as const;

function resolveTikTokAuth(): string | undefined {
  for (const name of TIKTOK_AUTH_ENV_VARS) {
    const value = process.env[name]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

export class TikTokConnector implements SocialConnector {
  id = "tiktok" as const;

  async checkConnection(): Promise<ConnectionStatus> {
    const auth = resolveTikTokAuth();
    if (!auth) {
      return { connected: false, reason: "tiktok_auth_not_configured" };
    }

    return {
      connected: true,
      accountLabel: "configured_via_env"
    };
  }

  async checkCapabilities(): Promise<SocialCapability> {
    return tiktokCapabilities;
  }

  async publish(input: SocialPublishRequest): Promise<SocialPublishResult> {
    if (input.mediaPaths?.length && !input.mediaPaths.every(Boolean)) {
      return {
        accepted: false,
        platform: "tiktok",
        dryRun: input.dryRun,
        reason: "tiktok_media_invalid"
      };
    }

    return {
      accepted: false,
      platform: "tiktok",
      dryRun: input.dryRun,
      reason: input.dryRun ? "dry-run blocks publish" : "tiktok_publish_not_implemented"
    };
  }

  async reply(input: SocialPublishRequest): Promise<SocialPublishResult> {
    return {
      accepted: false,
      platform: "tiktok",
      dryRun: input.dryRun,
      reason: input.dryRun ? "dry-run blocks reply" : "tiktok_reply_not_supported"
    };
  }
}
