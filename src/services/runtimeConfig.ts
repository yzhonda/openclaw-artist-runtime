import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defaultArtistRuntimeConfig } from "../config/defaultConfig.js";
import { migrateConfig } from "../config/migrations.js";
import { applyConfigDefaults, validateConfig } from "../config/schema.js";
import type { ArtistRuntimeConfig } from "../types.js";

function configOverridePath(root: string): string {
  return join(root, "runtime", "config-overrides.json");
}

function enforceFrozenPlatformBoundaries(config: ArtistRuntimeConfig): ArtistRuntimeConfig {
  const { lastTestedAt: _lastTestedAt, ...tiktokConfig } = config.distribution.platforms.tiktok;
  return {
    ...config,
    distribution: {
      ...config.distribution,
      platforms: {
        ...config.distribution.platforms,
        tiktok: {
          ...tiktokConfig,
          authStatus: "unconfigured",
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
  return migrateConfig(JSON.parse(contents));
}

export async function readResolvedConfig(root: string): Promise<ArtistRuntimeConfig> {
  return enforceFrozenPlatformBoundaries(applyConfigDefaults(await readConfigOverrides(root)));
}

export function resolveDefaultWorkspaceRoot(): string {
  const envWorkspace = process.env.OPENCLAW_LOCAL_WORKSPACE?.trim();
  return envWorkspace || defaultArtistRuntimeConfig.artist.workspaceRoot;
}

export function isPersonaProposerEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.OPENCLAW_PERSONA_PROPOSER?.trim().toLowerCase() !== "off";
}

export function isSongProposerEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.OPENCLAW_SONG_PROPOSER?.trim().toLowerCase() !== "off";
}

function positiveNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }
  return undefined;
}

export async function resolveSunoDailyBudget(
  root: string = resolveDefaultWorkspaceRoot(),
  env: NodeJS.ProcessEnv = process.env
): Promise<number> {
  const envBudget = positiveNumber(env.OPENCLAW_SUNO_DAILY_BUDGET);
  if (envBudget !== undefined) {
    return envBudget;
  }
  const overrides = await readConfigOverrides(root);
  const rawSuno = (overrides as { suno?: { dailyBudget?: unknown } }).suno;
  const overrideBudget = positiveNumber(rawSuno?.dailyBudget);
  return overrideBudget ?? 50;
}

function isRelativeWorkspaceRoot(value: string): boolean {
  return value === "." || value === "./" || value === "" || value.startsWith("./") || value.startsWith("../");
}

export async function resolveRuntimeConfig(
  payloadConfig?: Partial<ArtistRuntimeConfig>,
  fallbackWorkspaceRoot: string = resolveDefaultWorkspaceRoot()
): Promise<ArtistRuntimeConfig> {
  const workspaceRoot = payloadConfig?.artist?.workspaceRoot ?? fallbackWorkspaceRoot;
  const persisted = await readResolvedConfig(workspaceRoot);
  const normalizedPersisted = isRelativeWorkspaceRoot(persisted.artist.workspaceRoot)
    ? { ...persisted, artist: { ...persisted.artist, workspaceRoot } }
    : persisted;
  return payloadConfig ? mergeResolvedConfig(normalizedPersisted, payloadConfig) : normalizedPersisted;
}

export function mergeResolvedConfig(current: ArtistRuntimeConfig, patch: Partial<ArtistRuntimeConfig>): ArtistRuntimeConfig {
  return enforceFrozenPlatformBoundaries(applyConfigDefaults({
    ...current,
    ...patch,
    schemaVersion: patch.schemaVersion ?? current.schemaVersion,
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
