import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { SocialConnector } from "./SocialConnector.js";
import type { SocialCapability, SocialPublishRequest, SocialPublishResult } from "../../types/social.js";

const execFileAsync = promisify(execFile);

export class XBirdConnector implements SocialConnector {
  id = "x" as const;
  label = "X via Bird";

  async checkConnection() {
    try {
      const { stdout } = await execFileAsync("bird", ["whoami"], { timeout: 15_000 });
      return { ok: true, account: stdout.trim() };
    } catch (error: any) {
      return { ok: false, message: error?.message ?? "Bird unavailable" };
    }
  }

  async checkCapabilities(): Promise<SocialCapability> {
    return {
      textPost: true,
      imagePost: false,
      videoPost: false,
      carouselPost: false,
      reelPost: false,
      reply: true,
      quote: false,
      dm: false,
      scheduledPost: false,
      metrics: false,
    };
  }

  async publish(input: SocialPublishRequest): Promise<SocialPublishResult> {
    if (!input.text && !input.caption) {
      return { ok: false, platform: "x", error: "Missing text", verified: false };
    }
    // TODO: verify exact Bird command. This is a placeholder.
    const text = input.text ?? input.caption ?? "";
    try {
      const { stdout } = await execFileAsync("bird", ["tweet", text], { timeout: 30_000 });
      return { ok: true, platform: "x", externalId: stdout.trim(), verified: true };
    } catch (error: any) {
      return { ok: false, platform: "x", error: error?.message ?? "Bird publish failed", verified: false };
    }
  }
}