import { defaultArtistRuntimeConfig } from "./defaultConfig.js";
import {
  dailySharingModes,
  instagramAuthorityModes,
  officialReleaseModes,
  producerDigestModes,
  sunoAuthorityModes,
  sunoConnectionModes,
  sunoDriverModes,
  sunoSubmitModes,
  tiktokAuthorityModes,
  type ArtistRuntimeConfig,
  type ValidationResult,
  xAuthorityModes
} from "../types.js";

type PartialDeep<T> = {
  [K in keyof T]?: T[K] extends string[] ? string[] : T[K] extends Record<string, unknown> ? PartialDeep<T[K]> : T[K];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIntegerInRange(value: unknown, min: number, max: number): boolean {
  return Number.isInteger(value) && Number(value) >= min && Number(value) <= max;
}

function validateKnownKeys(path: string, record: Record<string, unknown>, allowed: readonly string[], errors: string[]): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      errors.push(`${path}.${key} is not allowed`);
    }
  }
}

function validateEnum(path: string, value: unknown, allowed: readonly string[], errors: string[]): void {
  if (typeof value !== "string" || !allowed.includes(value)) {
    errors.push(`${path} must be one of ${allowed.join(", ")}`);
  }
}

function validateStringArray(path: string, value: unknown, errors: string[]): void {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    errors.push(`${path} must be an array of strings`);
  }
}

export function applyConfigDefaults(config?: PartialDeep<ArtistRuntimeConfig>): ArtistRuntimeConfig {
  const merged = structuredClone(defaultArtistRuntimeConfig);
  if (!config) {
    return merged;
  }

  if (config.artist) {
    Object.assign(merged.artist, config.artist);
  }
  if (config.autopilot) {
    Object.assign(merged.autopilot, config.autopilot);
  }
  if (config.music) {
    if (config.music.engine !== undefined) {
      merged.music.engine = config.music.engine;
    }
    if (config.music.suno) {
      Object.assign(merged.music.suno, config.music.suno);
    }
  }
  if (config.distribution) {
    if (config.distribution.enabled !== undefined) {
      merged.distribution.enabled = config.distribution.enabled;
    }
    if (config.distribution.liveGoArmed !== undefined) {
      merged.distribution.liveGoArmed = config.distribution.liveGoArmed;
    }
    if (config.distribution.dailySharing !== undefined) {
      merged.distribution.dailySharing = config.distribution.dailySharing;
    }
    if (config.distribution.officialRelease !== undefined) {
      merged.distribution.officialRelease = config.distribution.officialRelease;
    }
    if (config.distribution.platforms) {
      if (config.distribution.platforms.x) {
        Object.assign(merged.distribution.platforms.x, config.distribution.platforms.x);
      }
      if (config.distribution.platforms.instagram) {
        Object.assign(merged.distribution.platforms.instagram, config.distribution.platforms.instagram);
      }
      if (config.distribution.platforms.tiktok) {
        Object.assign(merged.distribution.platforms.tiktok, config.distribution.platforms.tiktok);
      }
    }
  }
  if (config.safety) {
    Object.assign(merged.safety, config.safety);
  }

  return merged;
}

export function validateConfig(config: unknown): ValidationResult<ArtistRuntimeConfig> {
  const errors: string[] = [];
  if (!isRecord(config)) {
    return { ok: false, errors: ["config must be an object"] };
  }

  validateKnownKeys("config", config, ["artist", "autopilot", "music", "distribution", "safety"], errors);

  if ("artist" in config) {
    if (!isRecord(config.artist)) {
      errors.push("config.artist must be an object");
    } else {
      validateKnownKeys("config.artist", config.artist, ["mode", "artistId", "profilePath", "workspaceRoot"], errors);
      if (!("mode" in config.artist)) {
        errors.push("config.artist.mode is required when config.artist is present");
      } else if (config.artist.mode !== "public_artist") {
        errors.push("config.artist.mode must be public_artist");
      }
      if ("artistId" in config.artist && typeof config.artist.artistId !== "string") {
        errors.push("config.artist.artistId must be a string");
      }
      if ("profilePath" in config.artist && typeof config.artist.profilePath !== "string") {
        errors.push("config.artist.profilePath must be a string");
      }
      if ("workspaceRoot" in config.artist && typeof config.artist.workspaceRoot !== "string") {
        errors.push("config.artist.workspaceRoot must be a string");
      }
    }
  }

  if ("autopilot" in config) {
    if (!isRecord(config.autopilot)) {
      errors.push("config.autopilot must be an object");
    } else {
      validateKnownKeys("config.autopilot", config.autopilot, ["enabled", "dryRun", "songsPerWeek", "cycleIntervalMinutes", "producerDigest"], errors);
      if ("enabled" in config.autopilot && typeof config.autopilot.enabled !== "boolean") {
        errors.push("config.autopilot.enabled must be a boolean");
      }
      if ("dryRun" in config.autopilot && typeof config.autopilot.dryRun !== "boolean") {
        errors.push("config.autopilot.dryRun must be a boolean");
      }
      if ("songsPerWeek" in config.autopilot && !isIntegerInRange(config.autopilot.songsPerWeek, 0, 21)) {
        errors.push("config.autopilot.songsPerWeek must be an integer between 0 and 21");
      }
      if ("cycleIntervalMinutes" in config.autopilot && !isIntegerInRange(config.autopilot.cycleIntervalMinutes, 15, 1440)) {
        errors.push("config.autopilot.cycleIntervalMinutes must be an integer between 15 and 1440");
      }
      if ("producerDigest" in config.autopilot) {
        validateEnum("config.autopilot.producerDigest", config.autopilot.producerDigest, producerDigestModes, errors);
      }
    }
  }

  if ("music" in config) {
    if (!isRecord(config.music)) {
      errors.push("config.music must be an object");
    } else {
      validateKnownKeys("config.music", config.music, ["engine", "suno"], errors);
      if ("engine" in config.music) {
        validateEnum("config.music.engine", config.music.engine, ["suno"], errors);
      }
      if ("suno" in config.music) {
        if (!isRecord(config.music.suno)) {
          errors.push("config.music.suno must be an object");
        } else {
          validateKnownKeys(
            "config.music.suno",
            config.music.suno,
            [
              "enabled",
              "connectionMode",
              "driver",
              "submitMode",
              "authority",
              "dailyCreditLimit",
              "monthlyGenerationBudget",
              "maxGenerationsPerDay",
              "minMinutesBetweenCreates",
              "stopOnLoginChallenge",
              "stopOnCaptcha",
              "stopOnPaymentPrompt",
              "promptLogging"
            ],
            errors
          );
          if ("enabled" in config.music.suno && typeof config.music.suno.enabled !== "boolean") {
            errors.push("config.music.suno.enabled must be a boolean");
          }
          if ("connectionMode" in config.music.suno) {
            validateEnum("config.music.suno.connectionMode", config.music.suno.connectionMode, sunoConnectionModes, errors);
          }
          if ("driver" in config.music.suno) {
            validateEnum("config.music.suno.driver", config.music.suno.driver, sunoDriverModes, errors);
          }
          if ("submitMode" in config.music.suno) {
            validateEnum("config.music.suno.submitMode", config.music.suno.submitMode, sunoSubmitModes, errors);
          }
          if ("authority" in config.music.suno) {
            validateEnum("config.music.suno.authority", config.music.suno.authority, sunoAuthorityModes, errors);
          }
          if ("dailyCreditLimit" in config.music.suno && !isIntegerInRange(config.music.suno.dailyCreditLimit, 1, 1000)) {
            errors.push("config.music.suno.dailyCreditLimit must be an integer between 1 and 1000");
          }
          if ("monthlyGenerationBudget" in config.music.suno && !isIntegerInRange(config.music.suno.monthlyGenerationBudget, 0, 1000)) {
            errors.push("config.music.suno.monthlyGenerationBudget must be an integer between 0 and 1000");
          }
          if ("maxGenerationsPerDay" in config.music.suno && !isIntegerInRange(config.music.suno.maxGenerationsPerDay, 0, 100)) {
            errors.push("config.music.suno.maxGenerationsPerDay must be an integer between 0 and 100");
          }
          if ("minMinutesBetweenCreates" in config.music.suno && !isIntegerInRange(config.music.suno.minMinutesBetweenCreates, 1, 1440)) {
            errors.push("config.music.suno.minMinutesBetweenCreates must be an integer between 1 and 1440");
          }
          if ("stopOnLoginChallenge" in config.music.suno && typeof config.music.suno.stopOnLoginChallenge !== "boolean") {
            errors.push("config.music.suno.stopOnLoginChallenge must be a boolean");
          }
          if ("stopOnCaptcha" in config.music.suno && typeof config.music.suno.stopOnCaptcha !== "boolean") {
            errors.push("config.music.suno.stopOnCaptcha must be a boolean");
          }
          if ("stopOnPaymentPrompt" in config.music.suno && typeof config.music.suno.stopOnPaymentPrompt !== "boolean") {
            errors.push("config.music.suno.stopOnPaymentPrompt must be a boolean");
          }
          if ("promptLogging" in config.music.suno) {
            validateEnum("config.music.suno.promptLogging", config.music.suno.promptLogging, ["full"], errors);
          }
        }
      }
    }
  }

  if ("distribution" in config) {
    if (!isRecord(config.distribution)) {
      errors.push("config.distribution must be an object");
    } else {
      validateKnownKeys("config.distribution", config.distribution, ["enabled", "liveGoArmed", "dailySharing", "officialRelease", "platforms"], errors);
      if ("enabled" in config.distribution && typeof config.distribution.enabled !== "boolean") {
        errors.push("config.distribution.enabled must be a boolean");
      }
      if ("liveGoArmed" in config.distribution && typeof config.distribution.liveGoArmed !== "boolean") {
        errors.push("config.distribution.liveGoArmed must be a boolean");
      }
      if ("dailySharing" in config.distribution) {
        validateEnum("config.distribution.dailySharing", config.distribution.dailySharing, dailySharingModes, errors);
      }
      if ("officialRelease" in config.distribution) {
        validateEnum("config.distribution.officialRelease", config.distribution.officialRelease, officialReleaseModes, errors);
      }
      if ("platforms" in config.distribution) {
        if (!isRecord(config.distribution.platforms)) {
          errors.push("config.distribution.platforms must be an object");
        } else {
          validateKnownKeys("config.distribution.platforms", config.distribution.platforms, ["x", "instagram", "tiktok"], errors);
          if ("x" in config.distribution.platforms) {
            validateXPlatform(config.distribution.platforms.x, errors);
          }
          if ("instagram" in config.distribution.platforms) {
            validateInstagramPlatform(config.distribution.platforms.instagram, errors);
          }
          if ("tiktok" in config.distribution.platforms) {
            validateTikTokPlatform(config.distribution.platforms.tiktok, errors);
          }
        }
      }
    }
  }

  if ("safety" in config) {
    if (!isRecord(config.safety)) {
      errors.push("config.safety must be an object");
    } else {
      validateKnownKeys(
        "config.safety",
        config.safety,
        ["auditLog", "failClosed", "forbiddenTopics", "forbidCaptchaBypass", "forbidCredentialLogging", "requireApprovalForHighRisk"],
        errors
      );
      if ("auditLog" in config.safety && typeof config.safety.auditLog !== "boolean") {
        errors.push("config.safety.auditLog must be a boolean");
      }
      if ("failClosed" in config.safety && typeof config.safety.failClosed !== "boolean") {
        errors.push("config.safety.failClosed must be a boolean");
      }
      if ("forbiddenTopics" in config.safety) {
        validateStringArray("config.safety.forbiddenTopics", config.safety.forbiddenTopics, errors);
      }
      if ("forbidCaptchaBypass" in config.safety && typeof config.safety.forbidCaptchaBypass !== "boolean") {
        errors.push("config.safety.forbidCaptchaBypass must be a boolean");
      }
      if ("forbidCredentialLogging" in config.safety && typeof config.safety.forbidCredentialLogging !== "boolean") {
        errors.push("config.safety.forbidCredentialLogging must be a boolean");
      }
      if ("requireApprovalForHighRisk" in config.safety && typeof config.safety.requireApprovalForHighRisk !== "boolean") {
        errors.push("config.safety.requireApprovalForHighRisk must be a boolean");
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, errors: [], value: applyConfigDefaults(config as PartialDeep<ArtistRuntimeConfig>) };
}

function validateXPlatform(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("config.distribution.platforms.x must be an object");
    return;
  }
  validateKnownKeys("config.distribution.platforms.x", value, ["enabled", "liveGoArmed", "connector", "authority", "maxPostsPerDay", "maxRepliesPerDay", "autoPostTypes"], errors);
  if ("enabled" in value && typeof value.enabled !== "boolean") {
    errors.push("config.distribution.platforms.x.enabled must be a boolean");
  }
  if ("liveGoArmed" in value && typeof value.liveGoArmed !== "boolean") {
    errors.push("config.distribution.platforms.x.liveGoArmed must be a boolean");
  }
  if ("connector" in value && value.connector !== "bird") {
    errors.push("config.distribution.platforms.x.connector must be bird");
  }
  if ("authority" in value) {
    validateEnum("config.distribution.platforms.x.authority", value.authority, xAuthorityModes, errors);
  }
  if ("maxPostsPerDay" in value && !isIntegerInRange(value.maxPostsPerDay, 0, 50)) {
    errors.push("config.distribution.platforms.x.maxPostsPerDay must be an integer between 0 and 50");
  }
  if ("maxRepliesPerDay" in value && !isIntegerInRange(value.maxRepliesPerDay, 0, 200)) {
    errors.push("config.distribution.platforms.x.maxRepliesPerDay must be an integer between 0 and 200");
  }
  if ("autoPostTypes" in value) {
    validateStringArray("config.distribution.platforms.x.autoPostTypes", value.autoPostTypes, errors);
  }
}

function validateInstagramPlatform(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("config.distribution.platforms.instagram must be an object");
    return;
  }
  validateKnownKeys("config.distribution.platforms.instagram", value, ["enabled", "liveGoArmed", "connector", "authority", "maxPostsPerDay", "autoPostTypes"], errors);
  if ("enabled" in value && typeof value.enabled !== "boolean") {
    errors.push("config.distribution.platforms.instagram.enabled must be a boolean");
  }
  if ("liveGoArmed" in value && typeof value.liveGoArmed !== "boolean") {
    errors.push("config.distribution.platforms.instagram.liveGoArmed must be a boolean");
  }
  if ("connector" in value && value.connector !== "instagram_content_publishing") {
    errors.push("config.distribution.platforms.instagram.connector must be instagram_content_publishing");
  }
  if ("authority" in value) {
    validateEnum("config.distribution.platforms.instagram.authority", value.authority, instagramAuthorityModes, errors);
  }
  if ("maxPostsPerDay" in value && !isIntegerInRange(value.maxPostsPerDay, 0, 20)) {
    errors.push("config.distribution.platforms.instagram.maxPostsPerDay must be an integer between 0 and 20");
  }
  if ("autoPostTypes" in value) {
    validateStringArray("config.distribution.platforms.instagram.autoPostTypes", value.autoPostTypes, errors);
  }
}

function validateTikTokPlatform(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("config.distribution.platforms.tiktok must be an object");
    return;
  }
  validateKnownKeys("config.distribution.platforms.tiktok", value, ["enabled", "liveGoArmed", "connector", "authority", "maxPostsPerDay", "autoPostTypes"], errors);
  if ("enabled" in value && typeof value.enabled !== "boolean") {
    errors.push("config.distribution.platforms.tiktok.enabled must be a boolean");
  }
  if ("liveGoArmed" in value && typeof value.liveGoArmed !== "boolean") {
    errors.push("config.distribution.platforms.tiktok.liveGoArmed must be a boolean");
  }
  if ("connector" in value && value.connector !== "tiktok_content_posting") {
    errors.push("config.distribution.platforms.tiktok.connector must be tiktok_content_posting");
  }
  if ("authority" in value) {
    validateEnum("config.distribution.platforms.tiktok.authority", value.authority, tiktokAuthorityModes, errors);
  }
  if ("maxPostsPerDay" in value && !isIntegerInRange(value.maxPostsPerDay, 0, 20)) {
    errors.push("config.distribution.platforms.tiktok.maxPostsPerDay must be an integer between 0 and 20");
  }
  if ("autoPostTypes" in value) {
    validateStringArray("config.distribution.platforms.tiktok.autoPostTypes", value.autoPostTypes, errors);
  }
}
