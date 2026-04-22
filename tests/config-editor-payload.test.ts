import { describe, expect, it } from "vitest";
import { buildConfigDraft, buildConfigUpdatePatch, validateConfigDraft } from "../ui/src/configEditor";

describe("config editor payload builder", () => {
  it("builds a draft from config response shape", () => {
    expect(buildConfigDraft({
      autopilot: {
        enabled: true,
        dryRun: true,
        songsPerWeek: 5,
        cycleIntervalMinutes: 180
      },
      distribution: {
        platforms: {
          x: { enabled: true, authority: "auto_publish" },
          instagram: { enabled: false, authority: "draft_only" },
          tiktok: { enabled: false, authority: "draft_only" }
        }
      }
    })).toEqual({
      autopilotEnabled: true,
      dryRun: true,
      songsPerWeek: "5",
      cycleIntervalMinutes: "180",
      xEnabled: true,
      xAuthority: "auto_publish",
      instagramEnabled: false,
      instagramAuthority: "draft_only",
      tiktokEnabled: false,
      tiktokAuthority: "draft_only"
    });
  });

  it("builds the config/update patch payload", () => {
    expect(buildConfigUpdatePatch({
      autopilotEnabled: true,
      dryRun: false,
      songsPerWeek: "7",
      cycleIntervalMinutes: "60",
      xEnabled: true,
      xAuthority: "auto_publish_and_low_risk_replies",
      instagramEnabled: true,
      instagramAuthority: "auto_publish_visuals",
      tiktokEnabled: false,
      tiktokAuthority: "draft_only"
    })).toEqual({
      autopilot: {
        enabled: true,
        dryRun: false,
        songsPerWeek: 7,
        cycleIntervalMinutes: 60
      },
      distribution: {
        platforms: {
          x: { enabled: true, authority: "auto_publish_and_low_risk_replies" },
          instagram: { enabled: true, authority: "auto_publish_visuals" },
          tiktok: { enabled: false, authority: "draft_only" }
        }
      }
    });
  });

  it("rejects out-of-range numeric values", () => {
    expect(validateConfigDraft({
      autopilotEnabled: true,
      dryRun: true,
      songsPerWeek: "24",
      cycleIntervalMinutes: "10",
      xEnabled: true,
      xAuthority: "draft_only",
      instagramEnabled: false,
      instagramAuthority: "draft_only",
      tiktokEnabled: false,
      tiktokAuthority: "draft_only"
    })).toBe("songsPerWeek must be between 0 and 21");
  });

  it("rejects non-whole-number values", () => {
    expect(validateConfigDraft({
      autopilotEnabled: true,
      dryRun: true,
      songsPerWeek: "2.5",
      cycleIntervalMinutes: "180",
      xEnabled: true,
      xAuthority: "draft_only",
      instagramEnabled: false,
      instagramAuthority: "draft_only",
      tiktokEnabled: false,
      tiktokAuthority: "draft_only"
    })).toBe("songsPerWeek must be a whole number");
  });

  it("rejects unsupported authority values", () => {
    expect(validateConfigDraft({
      autopilotEnabled: true,
      dryRun: true,
      songsPerWeek: "5",
      cycleIntervalMinutes: "180",
      xEnabled: true,
      xAuthority: "full_social_autonomy" as never,
      instagramEnabled: false,
      instagramAuthority: "draft_only",
      tiktokEnabled: false,
      tiktokAuthority: "draft_only"
    })).toBe("xAuthority must be one of the supported X authority modes");
  });
});
