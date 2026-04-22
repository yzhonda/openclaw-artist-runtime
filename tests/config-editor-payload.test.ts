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
          x: { enabled: true },
          instagram: { enabled: false },
          tiktok: { enabled: false }
        }
      }
    })).toEqual({
      autopilotEnabled: true,
      dryRun: true,
      songsPerWeek: "5",
      cycleIntervalMinutes: "180",
      xEnabled: true,
      instagramEnabled: false,
      tiktokEnabled: false
    });
  });

  it("builds the config/update patch payload", () => {
    expect(buildConfigUpdatePatch({
      autopilotEnabled: true,
      dryRun: false,
      songsPerWeek: "7",
      cycleIntervalMinutes: "60",
      xEnabled: true,
      instagramEnabled: true,
      tiktokEnabled: false
    })).toEqual({
      autopilot: {
        enabled: true,
        dryRun: false,
        songsPerWeek: 7,
        cycleIntervalMinutes: 60
      },
      distribution: {
        platforms: {
          x: { enabled: true },
          instagram: { enabled: true },
          tiktok: { enabled: false }
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
      instagramEnabled: false,
      tiktokEnabled: false
    })).toBe("songsPerWeek must be between 0 and 21");
  });

  it("rejects non-whole-number values", () => {
    expect(validateConfigDraft({
      autopilotEnabled: true,
      dryRun: true,
      songsPerWeek: "2.5",
      cycleIntervalMinutes: "180",
      xEnabled: true,
      instagramEnabled: false,
      tiktokEnabled: false
    })).toBe("songsPerWeek must be a whole number");
  });
});
