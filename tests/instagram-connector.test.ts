import { describe, expect, it, vi, afterEach } from "vitest";
import { InstagramConnector } from "../src/connectors/social/instagramConnector.js";

describe("InstagramConnector", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reports not connected when auth env is missing", async () => {
    vi.stubEnv("OPENCLAW_INSTAGRAM_AUTH", "");
    vi.stubEnv("OPENCLAW_INSTAGRAM_ACCESS_TOKEN", "");
    vi.stubGlobal("fetch", vi.fn());

    const connector = new InstagramConnector();
    await expect(connector.checkConnection()).resolves.toEqual({
      connected: false,
      reason: "instagram_auth_not_configured"
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("reports connected when auth env is configured", async () => {
    vi.stubEnv("OPENCLAW_INSTAGRAM_AUTH", "configured-token");
    vi.stubEnv("OPENCLAW_INSTAGRAM_ACCESS_TOKEN", "");
    vi.stubGlobal("fetch", vi.fn());

    const connector = new InstagramConnector();
    await expect(connector.checkConnection()).resolves.toEqual({
      connected: true,
      accountLabel: "configured_via_env"
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("blocks publish in dry-run without external calls", async () => {
    vi.stubEnv("OPENCLAW_INSTAGRAM_AUTH", "configured-token");
    vi.stubGlobal("fetch", vi.fn());

    const connector = new InstagramConnector();
    await expect(connector.publish({
      dryRun: true,
      authority: "auto_publish_visuals",
      postType: "lyric_card",
      text: "dry-run card",
      mediaPaths: ["cover.png"]
    })).resolves.toEqual({
      accepted: false,
      platform: "instagram",
      dryRun: true,
      reason: "dry-run blocks publish"
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("fails closed for reply even when auth is configured", async () => {
    vi.stubEnv("OPENCLAW_INSTAGRAM_AUTH", "configured-token");
    vi.stubGlobal("fetch", vi.fn());

    const connector = new InstagramConnector();
    await expect(connector.reply?.({
      dryRun: false,
      authority: "auto_publish_visuals",
      postType: "comment_reply",
      text: "not supported",
      targetId: "123"
    })).resolves.toEqual({
      accepted: false,
      platform: "instagram",
      dryRun: false,
      reason: "instagram_reply_not_supported"
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
