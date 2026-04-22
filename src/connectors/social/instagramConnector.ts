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

const INSTAGRAM_AUTH_ENV_VARS = [
  "OPENCLAW_INSTAGRAM_AUTH",
  "OPENCLAW_INSTAGRAM_ACCESS_TOKEN"
] as const;

function resolveInstagramAuth(): string | undefined {
  for (const name of INSTAGRAM_AUTH_ENV_VARS) {
    const value = process.env[name]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

export class InstagramConnector implements SocialConnector {
  id = "instagram" as const;

  async checkConnection(): Promise<ConnectionStatus> {
    const auth = resolveInstagramAuth();
    if (!auth) {
      return { connected: false, reason: "instagram_auth_not_configured" };
    }

    return {
      connected: true,
      accountLabel: "configured_via_env"
    };
  }

  async checkCapabilities(): Promise<SocialCapability> {
    return instagramCapabilities;
  }

  async publish(input: SocialPublishRequest): Promise<SocialPublishResult> {
    if (input.mediaPaths?.length && !input.mediaPaths.every(Boolean)) {
      return {
        accepted: false,
        platform: "instagram",
        dryRun: input.dryRun,
        reason: "instagram_media_invalid"
      };
    }

    return {
      accepted: false,
      platform: "instagram",
      dryRun: input.dryRun,
      reason: input.dryRun ? "dry-run blocks publish" : "instagram_publish_not_implemented"
    };
  }

  async reply(input: SocialPublishRequest): Promise<SocialPublishResult> {
    return {
      accepted: false,
      platform: "instagram",
      dryRun: input.dryRun,
      reason: input.dryRun ? "dry-run blocks reply" : "instagram_reply_not_supported"
    };
  }
}
