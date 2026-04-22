import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defaultArtistRuntimeConfig } from "../config/defaultConfig.js";
import { applyConfigDefaults, validateConfig } from "../config/schema.js";
import type { ArtistRuntimeConfig } from "../types.js";

function configOverridePath(root: string): string {
  return join(root, "runtime", "config-overrides.json");
}

function enforceFrozenPlatformBoundaries(config: ArtistRuntimeConfig): ArtistRuntimeConfig {
  return {
    ...config,
    distribution: {
      ...config.distribution,
      platforms: {
        ...config.distribution.platforms,
        tiktok: {
          ...config.distribution.platforms.tiktok,
          liveGoArmed: false
        }
      }
    }
  };
}

export async function readConfigOverrides(root: string): Promise<Partial<ArtistRuntimeConfig>> {
  const contents = await readFile(configOverridePath(root), "utf8").catch(() => "");
  if (!contents) {
    return {};
  }
  return JSON.parse(contents) as Partial<ArtistRuntimeConfig>;
}

export async function readResolvedConfig(root: string): Promise<ArtistRuntimeConfig> {
  return enforceFrozenPlatformBoundaries(applyConfigDefaults(await readConfigOverrides(root)));
}

export async function resolveRuntimeConfig(
  payloadConfig?: Partial<ArtistRuntimeConfig>,
  fallbackWorkspaceRoot = defaultArtistRuntimeConfig.artist.workspaceRoot
): Promise<ArtistRuntimeConfig> {
  const workspaceRoot = payloadConfig?.artist?.workspaceRoot ?? fallbackWorkspaceRoot;
  const persisted = await readResolvedConfig(workspaceRoot);
  return payloadConfig ? mergeResolvedConfig(persisted, payloadConfig) : persisted;
}

export function mergeResolvedConfig(current: ArtistRuntimeConfig, patch: Partial<ArtistRuntimeConfig>): ArtistRuntimeConfig {
  return enforceFrozenPlatformBoundaries(applyConfigDefaults({
    ...current,
    ...patch,
    artist: { ...current.artist, ...patch.artist },
    autopilot: { ...current.autopilot, ...patch.autopilot },
    music: {
      ...current.music,
      ...patch.music,
      suno: { ...current.music.suno, ...patch.music?.suno }
    },
    distribution: {
      ...current.distribution,
      ...patch.distribution,
      platforms: {
        x: { ...current.distribution.platforms.x, ...patch.distribution?.platforms?.x },
        instagram: { ...current.distribution.platforms.instagram, ...patch.distribution?.platforms?.instagram },
        tiktok: { ...current.distribution.platforms.tiktok, ...patch.distribution?.platforms?.tiktok }
      }
    },
    safety: { ...current.safety, ...patch.safety }
  }));
}

export async function writeConfigOverrides(root: string, config: ArtistRuntimeConfig): Promise<ArtistRuntimeConfig> {
  const validation = validateConfig(enforceFrozenPlatformBoundaries(config));
  if (!validation.ok || !validation.value) {
    throw new Error(`invalid config: ${validation.errors.join("; ")}`);
  }
  await mkdir(join(root, "runtime"), { recursive: true });
  await writeFile(configOverridePath(root), `${JSON.stringify(validation.value, null, 2)}\n`, "utf8");
  return validation.value;
}

export async function patchResolvedConfig(root: string, patch: Partial<ArtistRuntimeConfig>): Promise<ArtistRuntimeConfig> {
  const current = await readResolvedConfig(root);
  const merged = mergeResolvedConfig(current, patch);
  return writeConfigOverrides(root, merged);
}
