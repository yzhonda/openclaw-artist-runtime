import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InstagramConnector } from "../src/connectors/social/instagramConnector.js";
import { publishSocialAction } from "../src/services/socialPublishing.js";

function makeWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), "distribution-authority-wiring-"));
  mkdirSync(join(root, "songs", "song-001", "social"), { recursive: true });
  mkdirSync(join(root, "songs", "song-001", "audit"), { recursive: true });
  return root;
}

function allowInstagramVisualPublishing() {
  return vi.spyOn(InstagramConnector.prototype, "checkCapabilities").mockResolvedValue({
    textPost: false,
    imagePost: true,
    videoPost: true,
    carouselPost: true,
    reelPost: true,
    reply: false,
    quote: false,
    dm: false,
    scheduledPost: false,
    metrics: "unknown"
  });
}

describe("distribution authority wiring", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("forces dry-run hold when distribution is disabled even if authority is auto_publish_visuals", async () => {
    const root = makeWorkspace();
    allowInstagramVisualPublishing();
    const publishSpy = vi.spyOn(InstagramConnector.prototype, "publish");

    const { result, entry } = await publishSocialAction({
      workspaceRoot: root,
      songId: "song-001",
      platform: "instagram",
      postType: "lyric_card",
      text: "low light, low tide",
      mediaPaths: ["https://example.com/card.png"],
      config: {
        autopilot: { dryRun: false },
        distribution: {
          enabled: false,
          platforms: {
            instagram: { enabled: true, authority: "auto_publish_visuals" }
          }
        }
      }
    });

    expect(result).toMatchObject({
      accepted: false,
      platform: "instagram",
      dryRun: true,
      reason: "dry-run blocks social publish"
    });
    expect(entry.dryRun).toBe(true);
    expect(entry.policyDecision?.policyDecision).toBe("deny_dry_run");
    expect(publishSpy).not.toHaveBeenCalled();
  });

  it("forces dry-run hold when the target platform is disabled even if authority is auto_publish_visuals", async () => {
    const root = makeWorkspace();
    allowInstagramVisualPublishing();
    const publishSpy = vi.spyOn(InstagramConnector.prototype, "publish");

    const { result, entry } = await publishSocialAction({
      workspaceRoot: root,
      songId: "song-001",
      platform: "instagram",
      postType: "lyric_card",
      text: "ashen neon weather",
      mediaPaths: ["https://example.com/card.png"],
      config: {
        autopilot: { dryRun: false },
        distribution: {
          enabled: true,
          platforms: {
            instagram: { enabled: false, authority: "auto_publish_visuals" }
          }
        }
      }
    });

    expect(result).toMatchObject({
      accepted: false,
      platform: "instagram",
      dryRun: true,
      reason: "dry-run blocks social publish"
    });
    expect(entry.dryRun).toBe(true);
    expect(entry.policyDecision?.policyDecision).toBe("deny_dry_run");
    expect(publishSpy).not.toHaveBeenCalled();
  });

  it("keeps live requests armed only when distribution and platform are enabled, then relies on connector live-go rejection", async () => {
    const root = makeWorkspace();
    vi.stubEnv("OPENCLAW_INSTAGRAM_ACCESS_TOKEN", "ig-token");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    allowInstagramVisualPublishing();
    const publishSpy = vi.spyOn(InstagramConnector.prototype, "publish");

    const { result, entry } = await publishSocialAction({
      workspaceRoot: root,
      songId: "song-001",
      platform: "instagram",
      postType: "lyric_card",
      text: "signal through the dust",
      mediaPaths: ["https://example.com/card.png"],
      config: {
        autopilot: { dryRun: false },
        distribution: {
          enabled: true,
          platforms: {
            instagram: { enabled: true, authority: "auto_publish_visuals" }
          }
        }
      }
    });

    expect(result).toMatchObject({
      accepted: false,
      platform: "instagram",
      dryRun: false,
      reason: "requires_explicit_live_go"
    });
    expect(entry.dryRun).toBe(false);
    expect(entry.policyDecision?.policyDecision).toBe("allow_publish");
    expect(publishSpy).toHaveBeenCalledOnce();
    expect(publishSpy.mock.calls[0]?.[0]).toMatchObject({
      dryRun: false,
      authority: "auto_publish_visuals",
      postType: "lyric_card"
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
