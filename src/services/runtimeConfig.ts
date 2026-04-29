import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { defaultArtistRuntimeConfig } from "../config/defaultConfig.js";
import { migrateConfig } from "../config/migrations.js";
import { applyConfigDefaults, validateConfig } from "../config/schema.js";
import type { ArtistRuntimeConfig } from "../types.js";

function configOverridePath(root: string): string {
  return join(root, "runtime", "config-overrides.json");
}

function configOverrideBackupPath(root: string, now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return join(root, "runtime", `config-overrides.${stamp}.bak.json`);
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

type ConfigOverridesRecord = Omit<Partial<ArtistRuntimeConfig>, "autopilot"> & {
  suno?: { dailyBudget?: unknown };
  bird?: { rateLimits?: { dailyMax?: unknown; minIntervalMinutes?: unknown } };
  autopilot?: Partial<ArtistRuntimeConfig["autopilot"]> & { intervalMinutes?: unknown };
};

export interface RuntimeSafetyOverridesPatch {
  suno?: { dailyBudget?: number };
  bird?: { rateLimits?: { dailyMax?: number; minIntervalMinutes?: number } };
  autopilot?: { intervalMinutes?: number };
}

function normalizeResolvedOverrideConfig(overrides: ConfigOverridesRecord): Partial<ArtistRuntimeConfig> {
  const { suno: _suno, bird: _bird, ...rest } = overrides;
  const autopilot = rest.autopilot
    ? { ...rest.autopilot } as Partial<ArtistRuntimeConfig["autopilot"]> & { intervalMinutes?: unknown }
    : undefined;
  if (autopilot && typeof autopilot.intervalMinutes === "number" && !("cycleIntervalMinutes" in autopilot)) {
    autopilot.cycleIntervalMinutes = autopilot.intervalMinutes;
  }
  if (autopilot && "intervalMinutes" in autopilot) {
    delete autopilot.intervalMinutes;
  }
  return {
    ...rest,
    ...(autopilot ? { autopilot } : {})
  } as Partial<ArtistRuntimeConfig>;
}

export async function readResolvedConfig(root: string): Promise<ArtistRuntimeConfig> {
  return enforceFrozenPlatformBoundaries(applyConfigDefaults(normalizeResolvedOverrideConfig(await readConfigOverrides(root) as ConfigOverridesRecord)));
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

export function isLegacyWizardEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.OPENCLAW_LEGACY_WIZARD?.trim().toLowerCase() === "on";
}

export function isInlineButtonsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.OPENCLAW_INLINE_BUTTONS?.trim().toLowerCase() !== "off";
}

export function isXInlineButtonEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.OPENCLAW_X_INLINE_BUTTON?.trim().toLowerCase() !== "off";
}

export function isArtistPulseEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.OPENCLAW_ARTIST_PULSE_ENABLED?.trim().toLowerCase();
  return value === "on" || value === "1" || value === "true";
}

export function isArtistPulseConfigured(config: Pick<ArtistRuntimeConfig, "artistPulse">, env: NodeJS.ProcessEnv = process.env): boolean {
  return isArtistPulseEnabled(env) || config.artistPulse.enabled;
}

export function isCommissionEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.OPENCLAW_COMMISSION_ENABLED?.trim().toLowerCase();
  return value === "on" || value === "1" || value === "true";
}

export function isCommissionConfigured(config: Pick<ArtistRuntimeConfig, "commission">, env: NodeJS.ProcessEnv = process.env): boolean {
  return isCommissionEnabled(env) || config.commission.enabled;
}

export function getArtistPulseIntervalHours(
  env: NodeJS.ProcessEnv = process.env,
  config?: Pick<ArtistRuntimeConfig, "artistPulse">
): number {
  const parsed = Number.parseInt(env.OPENCLAW_ARTIST_PULSE_HOURS ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return Math.max(6, config?.artistPulse.minIntervalHours ?? 12);
  }
  return Math.max(6, parsed);
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

function deepMergeRuntimeOverrides(current: ConfigOverridesRecord, patch: RuntimeSafetyOverridesPatch): ConfigOverridesRecord {
  return {
    ...current,
    suno: {
      ...current.suno,
      ...patch.suno
    },
    bird: {
      ...current.bird,
      ...(patch.bird ? {
        rateLimits: {
          ...current.bird?.rateLimits,
          ...patch.bird.rateLimits
        }
      } : {})
    },
    autopilot: {
      ...current.autopilot,
      ...patch.autopilot
    }
  };
}

async function writeOverridesFile(root: string, value: unknown): Promise<void> {
  const path = configOverridePath(root);
  const runtimeDir = dirname(path);
  await mkdir(runtimeDir, { recursive: true });
  const existing = await readFile(path, "utf8").catch(() => "");
  if (existing) {
    await copyFile(path, configOverrideBackupPath(root)).catch(() => undefined);
  }
  const tmpPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmpPath, path);
}

export async function writeRuntimeSafetyOverrides(root: string, patch: RuntimeSafetyOverridesPatch): Promise<ConfigOverridesRecord> {
  const current = await readConfigOverrides(root) as ConfigOverridesRecord;
  const next = deepMergeRuntimeOverrides(current, patch);
  await writeOverridesFile(root, next);
  return next;
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
    artistPulse: { ...current.artistPulse, ...patch.artistPulse },
    safety: { ...current.safety, ...patch.safety }
  }));
}

export async function writeConfigOverrides(root: string, config: ArtistRuntimeConfig): Promise<ArtistRuntimeConfig> {
  const validation = validateConfig(enforceFrozenPlatformBoundaries(config));
  if (!validation.ok || !validation.value) {
    throw new Error(`invalid config: ${validation.errors.join("; ")}`);
  }
  await writeOverridesFile(root, validation.value);
  return validation.value;
}

export async function patchResolvedConfig(root: string, patch: Partial<ArtistRuntimeConfig>): Promise<ArtistRuntimeConfig> {
  const current = await readResolvedConfig(root);
  const merged = mergeResolvedConfig(current, patch);
  return writeConfigOverrides(root, merged);
}
