import {
  instagramAuthorityModes,
  tiktokAuthorityModes,
  xAuthorityModes,
  type InstagramAuthority,
  type TikTokAuthority,
  type XAuthority
} from "../../src/types";

export type ConfigEditorSource = {
  music: {
    suno: {
      dailyCreditLimit: number;
    };
  };
  autopilot: {
    enabled: boolean;
    dryRun: boolean;
    songsPerWeek: number;
    cycleIntervalMinutes: number;
  };
  distribution: {
    liveGoArmed: boolean;
    platforms: {
      x: { enabled: boolean; liveGoArmed: boolean; authority: XAuthority };
      instagram: { enabled: boolean; liveGoArmed: boolean; authority: InstagramAuthority };
      tiktok: { enabled: boolean; liveGoArmed: boolean; authority: TikTokAuthority };
    };
  };
};

export type ConfigDraft = {
  dailyCreditLimit: string;
  autopilotEnabled: boolean;
  dryRun: boolean;
  songsPerWeek: string;
  cycleIntervalMinutes: string;
  distributionLiveGoArmed: boolean;
  xEnabled: boolean;
  xLiveGoArmed: boolean;
  xAuthority: XAuthority;
  instagramEnabled: boolean;
  instagramLiveGoArmed: boolean;
  instagramAuthority: InstagramAuthority;
  tiktokEnabled: boolean;
  tiktokLiveGoArmed: boolean;
  tiktokAuthority: TikTokAuthority;
};

export type ConfigUpdatePatch = {
  music: {
    suno: {
      dailyCreditLimit: number;
    };
  };
  autopilot: {
    enabled: boolean;
    dryRun: boolean;
    songsPerWeek: number;
    cycleIntervalMinutes: number;
  };
  distribution: {
    liveGoArmed: boolean;
    platforms: {
      x: { enabled: boolean; liveGoArmed: boolean; authority: XAuthority };
      instagram: { enabled: boolean; liveGoArmed: boolean; authority: InstagramAuthority };
      tiktok: { enabled: boolean; liveGoArmed: boolean; authority: TikTokAuthority };
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
    dailyCreditLimit: String(source.music.suno.dailyCreditLimit),
    autopilotEnabled: source.autopilot.enabled,
    dryRun: source.autopilot.dryRun,
    songsPerWeek: String(source.autopilot.songsPerWeek),
    cycleIntervalMinutes: String(source.autopilot.cycleIntervalMinutes),
    distributionLiveGoArmed: source.distribution.liveGoArmed,
    xEnabled: source.distribution.platforms.x.enabled,
    xLiveGoArmed: source.distribution.platforms.x.liveGoArmed,
    xAuthority: source.distribution.platforms.x.authority,
    instagramEnabled: source.distribution.platforms.instagram.enabled,
    instagramLiveGoArmed: source.distribution.platforms.instagram.liveGoArmed,
    instagramAuthority: source.distribution.platforms.instagram.authority,
    tiktokEnabled: source.distribution.platforms.tiktok.enabled,
    tiktokLiveGoArmed: source.distribution.platforms.tiktok.liveGoArmed,
    tiktokAuthority: source.distribution.platforms.tiktok.authority
  };
}

export function buildConfigUpdatePatch(draft: ConfigDraft): ConfigUpdatePatch {
  const dailyCreditLimit = parseWholeNumber(draft.dailyCreditLimit, "dailyCreditLimit");
  const songsPerWeek = parseWholeNumber(draft.songsPerWeek, "songsPerWeek");
  const cycleIntervalMinutes = parseWholeNumber(draft.cycleIntervalMinutes, "cycleIntervalMinutes");

  if (dailyCreditLimit < 1 || dailyCreditLimit > 1000) {
    throw new Error("dailyCreditLimit must be between 1 and 1000");
  }

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
    music: {
      suno: {
        dailyCreditLimit
      }
    },
    autopilot: {
      enabled: draft.autopilotEnabled,
      dryRun: draft.dryRun,
      songsPerWeek,
      cycleIntervalMinutes
    },
    distribution: {
      liveGoArmed: draft.distributionLiveGoArmed,
      platforms: {
        x: { enabled: draft.xEnabled, liveGoArmed: draft.xLiveGoArmed, authority: draft.xAuthority },
        instagram: { enabled: draft.instagramEnabled, liveGoArmed: draft.instagramLiveGoArmed, authority: draft.instagramAuthority },
        // TikTok stays frozen in the UI lane until the operator account exists.
        tiktok: { enabled: draft.tiktokEnabled, liveGoArmed: false, authority: draft.tiktokAuthority }
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
