import {
  instagramAuthorityModes,
  tiktokAuthorityModes,
  xAuthorityModes,
  type InstagramAuthority,
  type TikTokAuthority,
  type XAuthority
} from "../../src/types";

export type ConfigEditorSource = {
  autopilot: {
    enabled: boolean;
    dryRun: boolean;
    songsPerWeek: number;
    cycleIntervalMinutes: number;
  };
  distribution: {
    platforms: {
      x: { enabled: boolean; authority: XAuthority };
      instagram: { enabled: boolean; authority: InstagramAuthority };
      tiktok: { enabled: boolean; authority: TikTokAuthority };
    };
  };
};

export type ConfigDraft = {
  autopilotEnabled: boolean;
  dryRun: boolean;
  songsPerWeek: string;
  cycleIntervalMinutes: string;
  xEnabled: boolean;
  xAuthority: XAuthority;
  instagramEnabled: boolean;
  instagramAuthority: InstagramAuthority;
  tiktokEnabled: boolean;
  tiktokAuthority: TikTokAuthority;
};

export type ConfigUpdatePatch = {
  autopilot: {
    enabled: boolean;
    dryRun: boolean;
    songsPerWeek: number;
    cycleIntervalMinutes: number;
  };
  distribution: {
    platforms: {
      x: { enabled: boolean; authority: XAuthority };
      instagram: { enabled: boolean; authority: InstagramAuthority };
      tiktok: { enabled: boolean; authority: TikTokAuthority };
    };
  };
};

function parseWholeNumber(value: string, label: string): number {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`${label} must be a whole number`);
  }
  return Number(trimmed);
}

export function buildConfigDraft(source: ConfigEditorSource): ConfigDraft {
  return {
    autopilotEnabled: source.autopilot.enabled,
    dryRun: source.autopilot.dryRun,
    songsPerWeek: String(source.autopilot.songsPerWeek),
    cycleIntervalMinutes: String(source.autopilot.cycleIntervalMinutes),
    xEnabled: source.distribution.platforms.x.enabled,
    xAuthority: source.distribution.platforms.x.authority,
    instagramEnabled: source.distribution.platforms.instagram.enabled,
    instagramAuthority: source.distribution.platforms.instagram.authority,
    tiktokEnabled: source.distribution.platforms.tiktok.enabled,
    tiktokAuthority: source.distribution.platforms.tiktok.authority
  };
}

export function buildConfigUpdatePatch(draft: ConfigDraft): ConfigUpdatePatch {
  const songsPerWeek = parseWholeNumber(draft.songsPerWeek, "songsPerWeek");
  const cycleIntervalMinutes = parseWholeNumber(draft.cycleIntervalMinutes, "cycleIntervalMinutes");

  if (songsPerWeek < 0 || songsPerWeek > 21) {
    throw new Error("songsPerWeek must be between 0 and 21");
  }

  if (cycleIntervalMinutes < 15 || cycleIntervalMinutes > 1440) {
    throw new Error("cycleIntervalMinutes must be between 15 and 1440");
  }

  if (!xAuthorityModes.includes(draft.xAuthority)) {
    throw new Error("xAuthority must be one of the supported X authority modes");
  }

  if (!instagramAuthorityModes.includes(draft.instagramAuthority)) {
    throw new Error("instagramAuthority must be one of the supported Instagram authority modes");
  }

  if (!tiktokAuthorityModes.includes(draft.tiktokAuthority)) {
    throw new Error("tiktokAuthority must be one of the supported TikTok authority modes");
  }

  return {
    autopilot: {
      enabled: draft.autopilotEnabled,
      dryRun: draft.dryRun,
      songsPerWeek,
      cycleIntervalMinutes
    },
    distribution: {
      platforms: {
        x: { enabled: draft.xEnabled, authority: draft.xAuthority },
        instagram: { enabled: draft.instagramEnabled, authority: draft.instagramAuthority },
        tiktok: { enabled: draft.tiktokEnabled, authority: draft.tiktokAuthority }
      }
    }
  };
}

export function validateConfigDraft(draft: ConfigDraft): string | null {
  try {
    buildConfigUpdatePatch(draft);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
