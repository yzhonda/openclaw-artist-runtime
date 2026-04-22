export type ConfigEditorSource = {
  autopilot: {
    enabled: boolean;
    dryRun: boolean;
    songsPerWeek: number;
    cycleIntervalMinutes: number;
  };
  distribution: {
    platforms: {
      x: { enabled: boolean };
      instagram: { enabled: boolean };
      tiktok: { enabled: boolean };
    };
  };
};

export type ConfigDraft = {
  autopilotEnabled: boolean;
  dryRun: boolean;
  songsPerWeek: string;
  cycleIntervalMinutes: string;
  xEnabled: boolean;
  instagramEnabled: boolean;
  tiktokEnabled: boolean;
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
      x: { enabled: boolean };
      instagram: { enabled: boolean };
      tiktok: { enabled: boolean };
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
    instagramEnabled: source.distribution.platforms.instagram.enabled,
    tiktokEnabled: source.distribution.platforms.tiktok.enabled
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

  return {
    autopilot: {
      enabled: draft.autopilotEnabled,
      dryRun: draft.dryRun,
      songsPerWeek,
      cycleIntervalMinutes
    },
    distribution: {
      platforms: {
        x: { enabled: draft.xEnabled },
        instagram: { enabled: draft.instagramEnabled },
        tiktok: { enabled: draft.tiktokEnabled }
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
