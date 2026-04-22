import { readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyConfigDefaults } from "../config/schema.js";
import { defaultArtistRuntimeConfig } from "../config/defaultConfig.js";
import { InstagramConnector } from "../connectors/social/instagramConnector.js";
import { TikTokConnector } from "../connectors/social/tiktokConnector.js";
import { XBirdConnector } from "../connectors/social/xBirdConnector.js";
import { BrowserWorkerSunoConnector } from "../connectors/suno/browserWorkerConnector.js";
import { safeRegisterRoute } from "../pluginApi.js";
import { acknowledgeAlert } from "../services/alertAcks.js";
import { collectAlerts } from "../services/alerts.js";
import { listSongStates, readArtistMind, readSongState } from "../services/artistState.js";
import { ArtistAutopilotService, pauseAutopilot, readAutopilotRunState, resumeAutopilot } from "../services/autopilotService.js";
import { getAutopilotTicker, getAutopilotTickerIntervalMs, getLastOutcome, getLastTickAt } from "../services/autopilotTicker.js";
import { getSongPromptLedgerPath } from "../services/promptLedger.js";
import { mergeResolvedConfig, patchResolvedConfig, readResolvedConfig } from "../services/runtimeConfig.js";
import { publishSocialAction, readLatestSocialAction } from "../services/socialPublishing.js";
import { SocialDistributionWorker } from "../services/socialDistributionWorker.js";
import { prepareSocialAssets } from "../services/socialAssets.js";
import { readLatestPromptPackMetadata } from "../services/sunoPromptPackFiles.js";
import { generateSunoRun, readAllSunoRuns, readLatestSunoRun } from "../services/sunoRuns.js";
import { SunoBrowserWorker } from "../services/sunoBrowserWorker.js";
import { createSongIdea } from "../services/songIdeation.js";
import { readTakeHistory, selectTake } from "../services/takeSelection.js";
import type {
  ArtistRuntimeConfig,
  DistributionSummary,
  MusicSummary,
  PlatformStatus,
  PromptLedgerEntry,
  SetupChecklistItem,
  SetupReadiness,
  SocialPlatform,
  SocialPublishLedgerEntry,
  StatusResponse,
  SunoRunRecord
} from "../types.js";

async function readJsonlEntries<T>(path: string): Promise<T[]> {
  const contents = await readFile(path, "utf8").catch(() => "");
  if (!contents) {
    return [];
  }
  return contents
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function todayKey(value: string): string {
  return value.slice(0, 10);
}

function payloadRecord(input: unknown): Record<string, unknown> {
  return typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
}

async function readAllSocialActions(workspaceRoot: string): Promise<SocialPublishLedgerEntry[]> {
  const songs = await listSongStates(workspaceRoot);
  const all = await Promise.all(
    songs.map((song) => readJsonlEntries<SocialPublishLedgerEntry>(join(workspaceRoot, "songs", song.songId, "social", "social-publish.jsonl")))
  );
  return all.flat().sort((left, right) => right.timestamp.localeCompare(left.timestamp));
}

async function readAllAuditEvents(workspaceRoot: string) {
  const songs = await listSongStates(workspaceRoot);
  const all = await Promise.all(
    songs.map((song) =>
      readJsonlEntries<Record<string, unknown> & { timestamp: string }>(
        join(workspaceRoot, "songs", song.songId, "audit", "actions.jsonl")
      ).then((entries) => entries.map((entry) => ({ ...entry, songId: song.songId })))
    )
  );
  return all.flat().sort((left, right) => right.timestamp.localeCompare(left.timestamp));
}

async function buildPlatformStatuses(config: ArtistRuntimeConfig): Promise<Record<SocialPlatform, PlatformStatus>> {
  const xConnector = new XBirdConnector();
  const instagramConnector = new InstagramConnector();
  const tiktokConnector = new TikTokConnector();
  const actions = await readAllSocialActions(config.artist.workspaceRoot);
  const today = todayKey(new Date().toISOString());
  const summarize = (platform: SocialPlatform) => {
    const filtered = actions.filter((action) => action.platform === platform);
    const todayFiltered = filtered.filter((action) => todayKey(action.timestamp) === today);
    return {
      postsToday: todayFiltered.filter((action) => action.action === "publish").length,
      repliesToday: todayFiltered.filter((action) => action.action === "reply").length,
      lastAction: filtered[0]
    };
  };
  const xConnection = await xConnector.checkConnection();
  const instagramConnection = await instagramConnector.checkConnection();
  const tiktokConnection = await tiktokConnector.checkConnection();
  const xSummary = summarize("x");
  const instagramSummary = summarize("instagram");
  const tiktokSummary = summarize("tiktok");

  return {
    x: {
      connected: xConnection.connected,
      authority: config.distribution.platforms.x.authority,
      capabilitySummary: await xConnector.checkCapabilities(),
      accountLabel: xConnection.accountLabel,
      reason: xConnection.reason,
      postsToday: xSummary.postsToday,
      repliesToday: xSummary.repliesToday,
      lastAction: xSummary.lastAction
    },
    instagram: {
      connected: instagramConnection.connected,
      authority: config.distribution.platforms.instagram.authority,
      capabilitySummary: await instagramConnector.checkCapabilities(),
      accountLabel: instagramConnection.accountLabel,
      reason: instagramConnection.reason,
      postsToday: instagramSummary.postsToday,
      repliesToday: instagramSummary.repliesToday,
      lastAction: instagramSummary.lastAction
    },
    tiktok: {
      connected: tiktokConnection.connected,
      authority: config.distribution.platforms.tiktok.authority,
      capabilitySummary: await tiktokConnector.checkCapabilities(),
      accountLabel: tiktokConnection.accountLabel,
      reason: tiktokConnection.reason,
      postsToday: tiktokSummary.postsToday,
      repliesToday: tiktokSummary.repliesToday,
      lastAction: tiktokSummary.lastAction
    }
  };
}

async function buildWorkspaceSummaries(workspaceRoot: string): Promise<Pick<StatusResponse, "recentSong" | "lastSunoRun" | "lastSocialAction">> {
  const recentSong = (await listSongStates(workspaceRoot))[0];
  if (!recentSong) {
    return {};
  }

  return {
    recentSong,
    lastSunoRun: await readLatestSunoRun(workspaceRoot, recentSong.songId),
    lastSocialAction: await readLatestSocialAction(workspaceRoot, recentSong.songId)
  };
}

function buildTickerStatus(config: ArtistRuntimeConfig): StatusResponse["ticker"] {
  return {
    lastOutcome: getLastOutcome(),
    lastTickAt: getLastTickAt(),
    intervalMs: getAutopilotTickerIntervalMs(config)
  };
}

async function fileHasContent(path: string): Promise<boolean> {
  const contents = await readFile(path, "utf8").catch(() => "");
  return contents.trim().length > 0;
}

async function buildSetupReadiness(
  config: ArtistRuntimeConfig,
  autopilot: StatusResponse["autopilot"],
  sunoWorker: StatusResponse["sunoWorker"],
  platforms: Record<SocialPlatform, PlatformStatus>,
  workspaceStatus: Pick<StatusResponse, "recentSong" | "lastSunoRun" | "lastSocialAction">
): Promise<SetupReadiness> {
  const workspaceRoot = config.artist.workspaceRoot;
  const enabledPlatforms = (Object.entries(config.distribution.platforms) as Array<[SocialPlatform, ArtistRuntimeConfig["distribution"]["platforms"][SocialPlatform]]>)
    .filter(([, platformConfig]) => platformConfig.enabled)
    .map(([platform]) => platform);
  const artistProfileReady = await Promise.all([
    fileHasContent(join(workspaceRoot, "ARTIST.md")),
    fileHasContent(join(workspaceRoot, "SOUL.md")),
    fileHasContent(join(workspaceRoot, "artist", "SOCIAL_VOICE.md")),
    fileHasContent(join(workspaceRoot, "artist", "RELEASE_POLICY.md"))
  ]).then((values) => values.every(Boolean));
  const selectedPlatformsConnected = enabledPlatforms.length > 0 && enabledPlatforms.every((platform) => platforms[platform].connected);
  const budgetsReady = config.autopilot.cycleIntervalMinutes > 0
    && config.autopilot.songsPerWeek > 0
    && config.music.suno.monthlyGenerationBudget > 0
    && config.music.suno.maxGenerationsPerDay > 0;
  const hardStopsConfirmed = config.safety.failClosed
    && config.music.suno.stopOnLoginChallenge
    && config.music.suno.stopOnCaptcha
    && config.music.suno.stopOnPaymentPrompt;
  const dryRunCycleCompleted = Boolean(
    workspaceStatus.recentSong
    || workspaceStatus.lastSunoRun
    || workspaceStatus.lastSocialAction
    || autopilot.currentRunId
    || autopilot.lastSuccessfulStage
  );

  const checklist: SetupChecklistItem[] = [
    {
      id: "create_artist",
      label: "Create artist",
      state: artistProfileReady ? "complete" : "pending",
      detail: artistProfileReady
        ? "ARTIST.md, SOUL.md, SOCIAL_VOICE, and RELEASE_POLICY are present."
        : "Finish the artist constitution and voice files in the workspace template."
    },
    {
      id: "choose_platforms",
      label: "Choose platforms",
      state: enabledPlatforms.length > 0 ? "complete" : "pending",
      detail: enabledPlatforms.length > 0
        ? `Selected: ${enabledPlatforms.join(", ")}`
        : "Enable at least one public platform for daily sharing."
    },
    {
      id: "connect_suno",
      label: "Connect Suno",
      state: sunoWorker.connected ? "complete" : "pending",
      detail: sunoWorker.connected
        ? "Suno browser worker is connected."
        : sunoWorker.pendingAction ?? "Request operator login and keep the worker profile alive."
    },
    {
      id: "connect_social",
      label: "Connect selected social platforms",
      state: enabledPlatforms.length === 0 ? "pending" : selectedPlatformsConnected ? "complete" : "pending",
      detail: enabledPlatforms.length === 0
        ? "Choose platforms before checking social connections."
        : selectedPlatformsConnected
          ? "All enabled platforms report connected."
          : `Waiting on connections for ${enabledPlatforms.filter((platform) => !platforms[platform].connected).join(", ")}.`
    },
    {
      id: "budgets_and_cadence",
      label: "Choose budgets and cadence",
      state: budgetsReady ? "complete" : "attention",
      detail: budgetsReady
        ? `Cycle ${config.autopilot.cycleIntervalMinutes} min · ${config.music.suno.monthlyGenerationBudget} Suno runs/month.`
        : "Set positive cadence, weekly song target, and Suno budget limits."
    },
    {
      id: "confirm_hard_stops",
      label: "Confirm hard stops",
      state: hardStopsConfirmed ? "complete" : "attention",
      detail: hardStopsConfirmed
        ? "Fail-closed and Suno hard-stop rules are active."
        : "Turn on fail-closed mode and all Suno stop conditions."
    },
    {
      id: "run_dry_run_cycle",
      label: "Run dry-run cycle",
      state: dryRunCycleCompleted ? "complete" : "pending",
      detail: dryRunCycleCompleted
        ? `Observed via ${workspaceStatus.recentSong ? `song ${workspaceStatus.recentSong.songId}` : autopilot.currentRunId ?? "autopilot state"}.`
        : "Run one dry-run cycle to create initial song/runtime evidence."
    }
  ];

  const readyForAutopilot = checklist.every((item) => item.state === "complete");
  const autopilotLiveState: SetupChecklistItem = {
    id: "turn_on_autopilot",
    label: "Turn on autopilot",
    state: config.autopilot.enabled && !config.autopilot.dryRun
      ? readyForAutopilot ? "complete" : "attention"
      : "pending",
    detail: config.autopilot.enabled && !config.autopilot.dryRun
      ? readyForAutopilot
        ? "Live autopilot is enabled."
        : "Autopilot is live before setup is complete."
      : readyForAutopilot
        ? "Setup is ready; you can switch off dry-run and enable live autopilot."
        : "Keep dry-run on until the preceding setup items are complete."
  };
  checklist.push(autopilotLiveState);

  const completeCount = checklist.filter((item) => item.state === "complete").length;
  const nextIncomplete = checklist.find((item) => item.state !== "complete");

  return {
    completeCount,
    totalCount: checklist.length,
    readyForAutopilot,
    nextRecommendedAction: nextIncomplete?.label ?? "Setup complete",
    checklist
  };
}

export async function buildSongsResponse(config?: Partial<ArtistRuntimeConfig>) {
  const mergedConfig = await resolveRuntimeConfig(config);
  return listSongStates(mergedConfig.artist.workspaceRoot);
}

export async function buildSongDetailResponse(songId: string, config?: Partial<ArtistRuntimeConfig>) {
  const mergedConfig = await resolveRuntimeConfig(config);
  const workspaceRoot = mergedConfig.artist.workspaceRoot;
  const [state, brief, promptLedger, sunoRuns, latestSocialAction, selectedTake, socialAssets, latestPromptPack, takeHistory] = await Promise.all([
    readSongState(workspaceRoot, songId),
    readFile(join(workspaceRoot, "songs", songId, "brief.md"), "utf8").catch(() => ""),
    readJsonlEntries<PromptLedgerEntry>(join(workspaceRoot, "songs", songId, "prompts", "prompt-ledger.jsonl")),
    readAllSunoRuns(workspaceRoot, songId),
    readLatestSocialAction(workspaceRoot, songId),
    readFile(join(workspaceRoot, "songs", songId, "suno", "selected-take.json"), "utf8").then((value) => JSON.parse(value) as unknown).catch(() => undefined),
    readFile(join(workspaceRoot, "songs", songId, "social", "assets.json"), "utf8").then((value) => JSON.parse(value) as unknown).catch(() => []),
    readLatestPromptPackMetadata(workspaceRoot, songId),
    readTakeHistory(workspaceRoot, songId)
  ]);

  return {
    song: state,
    brief,
    promptLedger,
    sunoRuns,
    selectedTake,
    takeSelections: promptLedger.filter((entry) => entry.stage === "take_selection"),
    takeHistory,
    latestPromptPack,
    socialAssets,
    lastSocialAction: latestSocialAction
  };
}

export async function buildSongLedgerResponse(songId: string, config?: Partial<ArtistRuntimeConfig>) {
  const mergedConfig = await resolveRuntimeConfig(config);
  return readJsonlEntries<PromptLedgerEntry>(join(mergedConfig.artist.workspaceRoot, "songs", songId, "prompts", "prompt-ledger.jsonl"));
}

export async function buildPromptLedgerResponse(songId?: string, config?: Partial<ArtistRuntimeConfig>) {
  const mergedConfig = await resolveRuntimeConfig(config);
  if (songId) {
    return readJsonlEntries<PromptLedgerEntry>(getSongPromptLedgerPath(mergedConfig.artist.workspaceRoot, songId));
  }

  const songs = await listSongStates(mergedConfig.artist.workspaceRoot);
  const ledgers = await Promise.all(
    songs.map((song) =>
      readJsonlEntries<PromptLedgerEntry>(getSongPromptLedgerPath(mergedConfig.artist.workspaceRoot, song.songId))
        .then((entries) => entries.map((entry) => ({ ...entry, songId: entry.songId ?? song.songId })))
    )
  );
  return ledgers.flat().sort((left, right) => right.timestamp.localeCompare(left.timestamp));
}

export async function buildAlertsResponse(config?: Partial<ArtistRuntimeConfig>) {
  const mergedConfig = await resolveRuntimeConfig(config);
  const platforms = await buildPlatformStatuses(mergedConfig);
  const sunoWorker = await new BrowserWorkerSunoConnector(mergedConfig.artist.workspaceRoot).status();
  return collectAlerts(mergedConfig.artist.workspaceRoot, sunoWorker, platforms, mergedConfig);
}

export async function buildConfigResponse(config?: Partial<ArtistRuntimeConfig>) {
  return resolveRuntimeConfig(config);
}

async function resolveRuntimeConfig(config?: Partial<ArtistRuntimeConfig>): Promise<ArtistRuntimeConfig> {
  if (config) {
    const mergedConfig = applyConfigDefaults(config);
    const persisted = await readResolvedConfig(mergedConfig.artist.workspaceRoot);
    return mergeResolvedConfig(persisted, config);
  }
  return readResolvedConfig(defaultArtistRuntimeConfig.artist.workspaceRoot);
}

export async function buildArtistMindResponse(config?: Partial<ArtistRuntimeConfig>) {
  const mergedConfig = await resolveRuntimeConfig(config);
  return readArtistMind(mergedConfig.artist.workspaceRoot);
}

export async function buildAuditLogResponse(config?: Partial<ArtistRuntimeConfig>) {
  const mergedConfig = await resolveRuntimeConfig(config);
  return readAllAuditEvents(mergedConfig.artist.workspaceRoot);
}

export async function buildRecoveryResponse(config?: Partial<ArtistRuntimeConfig>) {
  const mergedConfig = await resolveRuntimeConfig(config);
  const [status, audit] = await Promise.all([
    buildStatusResponse(mergedConfig),
    buildAuditLogResponse(mergedConfig)
  ]);
  return {
    autopilot: status.autopilot,
    sunoWorker: status.sunoWorker,
    distributionWorker: status.distributionWorker,
    alerts: status.alerts,
    recentAudit: audit.slice(0, 10),
    diagnostics: {
      workspaceRoot: mergedConfig.artist.workspaceRoot,
      dryRun: status.dryRun,
      recentSongId: status.recentSong?.songId,
      currentRunId: status.autopilot.currentRunId,
      currentSongId: status.autopilot.currentSongId,
      blockedReason: status.autopilot.blockedReason ?? status.distributionWorker.blockedReason ?? status.sunoWorker.hardStopReason
    }
  };
}

export async function buildPlatformsResponse(config?: Partial<ArtistRuntimeConfig>) {
  const mergedConfig = await resolveRuntimeConfig(config);
  return buildPlatformStatuses(mergedConfig);
}

export async function buildPlatformDetailResponse(platform: SocialPlatform, config?: Partial<ArtistRuntimeConfig>) {
  const mergedConfig = await resolveRuntimeConfig(config);
  return (await buildPlatformStatuses(mergedConfig))[platform];
}

export async function buildSunoStatusResponse(config?: Partial<ArtistRuntimeConfig>) {
  const mergedConfig = await resolveRuntimeConfig(config);
  const workspaceRoot = mergedConfig.artist.workspaceRoot;
  const recentSong = (await listSongStates(workspaceRoot))[0];
  const worker = await new BrowserWorkerSunoConnector(workspaceRoot).status();
  const latestPromptPack = recentSong ? await readLatestPromptPackMetadata(workspaceRoot, recentSong.songId) : undefined;
  return {
    worker,
    currentSongId: recentSong?.songId,
    latestRun: recentSong ? await readLatestSunoRun(workspaceRoot, recentSong.songId) : undefined,
    recentRuns: recentSong ? await readAllSunoRuns(workspaceRoot, recentSong.songId) : [],
    latestPromptPackVersion: latestPromptPack?.version,
    latestPromptPackMetadata: latestPromptPack?.metadata
  };
}

async function buildMusicSummary(config: ArtistRuntimeConfig): Promise<MusicSummary> {
  const songs = await listSongStates(config.artist.workspaceRoot);
  const runs = (
    await Promise.all(
      songs.map((song) => readJsonlEntries<SunoRunRecord>(join(config.artist.workspaceRoot, "songs", song.songId, "suno", "runs.jsonl")))
    )
  ).flat();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const today = todayKey(new Date().toISOString());
  const recentSong = songs[0];
  const latestPromptPack = recentSong ? await readLatestPromptPackMetadata(config.artist.workspaceRoot, recentSong.songId) : undefined;
  return {
    monthlyGenerationBudget: config.music.suno.monthlyGenerationBudget,
    monthlyRuns: runs.filter((run) => run.createdAt.startsWith(currentMonth)).length,
    dailyRuns: runs.filter((run) => todayKey(run.createdAt) === today).length,
    latestPromptPackVersion: latestPromptPack?.version,
    latestPromptPackMetadata: latestPromptPack?.metadata
  };
}

async function buildDistributionSummary(config: ArtistRuntimeConfig, platforms: Record<SocialPlatform, PlatformStatus>): Promise<DistributionSummary> {
  const actions = await readAllSocialActions(config.artist.workspaceRoot);
  const today = todayKey(new Date().toISOString());
  const todayActions = actions.filter((action) => todayKey(action.timestamp) === today);
  const lastAction = actions[0];
  return {
    postsToday: todayActions.filter((action) => action.action === "publish").length,
    repliesToday: todayActions.filter((action) => action.action === "reply").length,
    lastPlatform: lastAction?.platform,
    lastPostUrl: lastAction?.url ?? platforms.x.lastAction?.url ?? platforms.instagram.lastAction?.url ?? platforms.tiktok.lastAction?.url
  };
}

export async function buildStatusResponse(config?: Partial<ArtistRuntimeConfig>): Promise<StatusResponse> {
  const mergedConfig = await resolveRuntimeConfig(config);
  const autopilot = await new ArtistAutopilotService().status(
    mergedConfig.autopilot.enabled,
    mergedConfig.autopilot.dryRun,
    mergedConfig.artist.workspaceRoot
  );
  const sunoWorker = await new BrowserWorkerSunoConnector(mergedConfig.artist.workspaceRoot).status();
  const distributionWorker = await new SocialDistributionWorker().status(mergedConfig);
  const workspaceStatus = await buildWorkspaceSummaries(mergedConfig.artist.workspaceRoot);
  const platforms = await buildPlatformStatuses(mergedConfig);
  const alerts = await collectAlerts(mergedConfig.artist.workspaceRoot, sunoWorker, platforms, mergedConfig);
  const [musicSummary, distributionSummary] = await Promise.all([
    buildMusicSummary(mergedConfig),
    buildDistributionSummary(mergedConfig, platforms)
  ]);
  const setupReadiness = await buildSetupReadiness(mergedConfig, autopilot, sunoWorker, platforms, workspaceStatus);

  return {
    config: mergedConfig,
    dryRun: mergedConfig.autopilot.dryRun,
    autopilot,
    ticker: buildTickerStatus(mergedConfig),
    sunoWorker,
    distributionWorker,
    platforms,
    musicSummary,
    distributionSummary,
    setupReadiness,
    alerts,
    recentSong: workspaceStatus.recentSong,
    lastSunoRun: workspaceStatus.lastSunoRun,
    lastSocialAction: workspaceStatus.lastSocialAction
  };
}

export function registerRoutes(api: unknown): void {
  safeRegisterRoute(api, {
    method: "GET",
    path: "/plugins/artist-runtime",
    contentType: "text/html; charset=utf-8",
    handler: async () => producerConsoleHtml()
  });

  safeRegisterRoute(api, {
    method: "GET",
    path: "/plugins/artist-runtime/api/status",
    handler: async (input) => buildStatusResponse(payloadRecord(input).config as Partial<ArtistRuntimeConfig> | undefined)
  });

  safeRegisterRoute(api, {
    method: "GET",
    path: "/plugins/artist-runtime/api/config",
    handler: async (input) => buildConfigResponse(payloadRecord(input).config as Partial<ArtistRuntimeConfig> | undefined)
  });

  safeRegisterRoute(api, {
    method: "GET",
    path: "/plugins/artist-runtime/api/artist-mind",
    handler: async (input) => buildArtistMindResponse(payloadRecord(input).config as Partial<ArtistRuntimeConfig> | undefined)
  });

  safeRegisterRoute(api, {
    method: "GET",
    path: "/plugins/artist-runtime/api/audit",
    handler: async (input) => buildAuditLogResponse(payloadRecord(input).config as Partial<ArtistRuntimeConfig> | undefined)
  });

  safeRegisterRoute(api, {
    method: "GET",
    path: "/plugins/artist-runtime/api/recovery",
    handler: async (input) => buildRecoveryResponse(payloadRecord(input).config as Partial<ArtistRuntimeConfig> | undefined)
  });

  safeRegisterRoute(api, {
    method: "GET",
    path: "/plugins/artist-runtime/api/songs",
    handler: async (input) => buildSongsResponse(payloadRecord(input).config as Partial<ArtistRuntimeConfig> | undefined)
  });

  safeRegisterRoute(api, {
    method: "GET",
    path: "/plugins/artist-runtime/api/songs/:songId",
    handler: async (input) => {
      const payload = payloadRecord(input);
      const songId = typeof payload.songId === "string" ? payload.songId : "song-001";
      return buildSongDetailResponse(songId, payload.config as Partial<ArtistRuntimeConfig> | undefined);
    }
  });

  safeRegisterRoute(api, {
    method: "GET",
    path: "/plugins/artist-runtime/api/songs/:songId/ledger",
    handler: async (input) => {
      const payload = payloadRecord(input);
      const songId = typeof payload.songId === "string" ? payload.songId : "song-001";
      return buildSongLedgerResponse(songId, payload.config as Partial<ArtistRuntimeConfig> | undefined);
    }
  });

  safeRegisterRoute(api, {
    method: "GET",
    path: "/plugins/artist-runtime/api/prompt-ledger",
    handler: async (input) => {
      const payload = payloadRecord(input);
      return buildPromptLedgerResponse(
        typeof payload.songId === "string" ? payload.songId : undefined,
        payload.config as Partial<ArtistRuntimeConfig> | undefined
      );
    }
  });

  safeRegisterRoute(api, {
    method: "GET",
    path: "/plugins/artist-runtime/api/alerts",
    handler: async (input) => buildAlertsResponse(payloadRecord(input).config as Partial<ArtistRuntimeConfig> | undefined)
  });

  safeRegisterRoute(api, {
    method: "POST",
    path: "/plugins/artist-runtime/api/alerts/:id/ack",
    handler: async (input) => {
      const payload = payloadRecord(input);
      const config = applyConfigDefaults(payload.config as Partial<ArtistRuntimeConfig> | undefined);
      return acknowledgeAlert(config.artist.workspaceRoot, typeof payload.id === "string" ? payload.id : "unknown");
    }
  });

  safeRegisterRoute(api, {
    method: "GET",
    path: "/plugins/artist-runtime/api/platforms",
    handler: async (input) => buildPlatformsResponse(payloadRecord(input).config as Partial<ArtistRuntimeConfig> | undefined)
  });

  safeRegisterRoute(api, {
    method: "GET",
    path: "/plugins/artist-runtime/api/platforms/:id",
    handler: async (input) => {
      const payload = payloadRecord(input);
      const platform = payload.id === "instagram" || payload.id === "tiktok" ? payload.id : "x";
      return buildPlatformDetailResponse(platform, payload.config as Partial<ArtistRuntimeConfig> | undefined);
    }
  });

  safeRegisterRoute(api, {
    method: "POST",
    path: "/plugins/artist-runtime/api/platforms/:id/test",
    handler: async (input) => {
      const payload = payloadRecord(input);
      const platform = payload.id === "instagram" || payload.id === "tiktok" ? payload.id : "x";
      const config = applyConfigDefaults(payload.config as Partial<ArtistRuntimeConfig> | undefined);
      const status = await buildPlatformDetailResponse(platform, config);
      return {
        platform,
        status,
        testedAt: new Date().toISOString()
      };
    }
  });

  safeRegisterRoute(api, {
    method: "POST",
    path: "/plugins/artist-runtime/api/platforms/x/simulate-reply",
    handler: async (input) => {
      const payload = payloadRecord(input);
      const baseConfig = applyConfigDefaults(payload.config as Partial<ArtistRuntimeConfig> | undefined);
      const config = mergeResolvedConfig(baseConfig, {
        autopilot: {
          dryRun: true
        } as ArtistRuntimeConfig["autopilot"]
      } as Partial<ArtistRuntimeConfig>);
      const songId = typeof payload.songId === "string"
        ? payload.songId
        : (await listSongStates(config.artist.workspaceRoot))[0]?.songId;
      if (!songId) {
        return {
          result: {
            accepted: false,
            platform: "x" as const,
            dryRun: true,
            reason: "no_song_selected_for_reply_simulation"
          },
          entry: undefined
        };
      }
      return publishSocialAction({
        workspaceRoot: config.artist.workspaceRoot,
        songId,
        platform: "x",
        action: "reply",
        postType: "reply",
        text: typeof payload.text === "string" ? payload.text : undefined,
        targetId: typeof payload.targetId === "string" ? payload.targetId : undefined,
        targetUrl: typeof payload.targetUrl === "string" ? payload.targetUrl : undefined,
        config
      });
    }
  });

  safeRegisterRoute(api, {
    method: "POST",
    path: "/plugins/artist-runtime/api/platforms/:id/connect",
    handler: async (input) => {
      const payload = payloadRecord(input);
      const platform = payload.id === "instagram" || payload.id === "tiktok" ? payload.id : "x";
      const config = applyConfigDefaults(payload.config as Partial<ArtistRuntimeConfig> | undefined);
      const nextConfig = await patchResolvedConfig(config.artist.workspaceRoot, {
        distribution: {
          platforms: {
            [platform]: { enabled: true }
          }
        } as unknown as ArtistRuntimeConfig["distribution"]
      } as Partial<ArtistRuntimeConfig>);
      return buildPlatformDetailResponse(platform, nextConfig);
    }
  });

  safeRegisterRoute(api, {
    method: "POST",
    path: "/plugins/artist-runtime/api/platforms/:id/disconnect",
    handler: async (input) => {
      const payload = payloadRecord(input);
      const platform = payload.id === "instagram" || payload.id === "tiktok" ? payload.id : "x";
      const config = applyConfigDefaults(payload.config as Partial<ArtistRuntimeConfig> | undefined);
      const nextConfig = await patchResolvedConfig(config.artist.workspaceRoot, {
        distribution: {
          platforms: {
            [platform]: { enabled: false }
          }
        } as unknown as ArtistRuntimeConfig["distribution"]
      } as Partial<ArtistRuntimeConfig>);
      return buildPlatformDetailResponse(platform, nextConfig);
    }
  });

  safeRegisterRoute(api, {
    method: "GET",
    path: "/plugins/artist-runtime/api/suno/status",
    handler: async (input) => buildSunoStatusResponse(payloadRecord(input).config as Partial<ArtistRuntimeConfig> | undefined)
  });

  safeRegisterRoute(api, {
    method: "GET",
    path: "/plugins/artist-runtime/api/suno/runs",
    handler: async (input) => {
      const payload = payloadRecord(input);
      const config = applyConfigDefaults(payload.config as Partial<ArtistRuntimeConfig> | undefined);
      const songId = typeof payload.songId === "string"
        ? payload.songId
        : (await listSongStates(config.artist.workspaceRoot))[0]?.songId;
      return songId ? readAllSunoRuns(config.artist.workspaceRoot, songId) : [];
    }
  });

  safeRegisterRoute(api, {
    method: "POST",
    path: "/plugins/artist-runtime/api/suno/connect",
    handler: async (input) => {
      const payload = payloadRecord(input);
      const config = applyConfigDefaults(payload.config as Partial<ArtistRuntimeConfig> | undefined);
      return new SunoBrowserWorker(config.artist.workspaceRoot).connect();
    }
  });

  safeRegisterRoute(api, {
    method: "POST",
    path: "/plugins/artist-runtime/api/suno/reconnect",
    handler: async (input) => {
      const payload = payloadRecord(input);
      const config = applyConfigDefaults(payload.config as Partial<ArtistRuntimeConfig> | undefined);
      return new SunoBrowserWorker(config.artist.workspaceRoot).reconnect();
    }
  });

  safeRegisterRoute(api, {
    method: "POST",
    path: "/plugins/artist-runtime/api/suno/generate/:songId",
    handler: async (input) => {
      const payload = payloadRecord(input);
      const config = applyConfigDefaults(payload.config as Partial<ArtistRuntimeConfig> | undefined);
      const songId = typeof payload.songId === "string" ? payload.songId : "song-001";
      return generateSunoRun({
        workspaceRoot: config.artist.workspaceRoot,
        songId,
        config
      });
    }
  });

  safeRegisterRoute(api, {
    method: "POST",
    path: "/plugins/artist-runtime/api/config/update",
    handler: async (input) => {
      const payload = payloadRecord(input);
      const context = applyConfigDefaults(payload.config as Partial<ArtistRuntimeConfig> | undefined);
      const patchRaw = (payload.patch ?? payload.config) as Partial<ArtistRuntimeConfig> | undefined;
      return patchResolvedConfig(context.artist.workspaceRoot, (patchRaw ?? {}) as Partial<ArtistRuntimeConfig>);
    }
  });

  safeRegisterRoute(api, {
    method: "POST",
    path: "/plugins/artist-runtime/api/pause",
    handler: async (input) => {
      const payload = payloadRecord(input);
      const config = applyConfigDefaults(payload.config as Partial<ArtistRuntimeConfig> | undefined);
      return pauseAutopilot(config.artist.workspaceRoot, typeof payload.reason === "string" ? payload.reason : undefined);
    }
  });

  safeRegisterRoute(api, {
    method: "POST",
    path: "/plugins/artist-runtime/api/resume",
    handler: async (input) => {
      const payload = payloadRecord(input);
      const config = applyConfigDefaults(payload.config as Partial<ArtistRuntimeConfig> | undefined);
      return resumeAutopilot(config.artist.workspaceRoot);
    }
  });

  safeRegisterRoute(api, {
    method: "POST",
    path: "/plugins/artist-runtime/api/run-cycle",
    handler: async (input) => {
      const payload = payloadRecord(input);
      const config = await resolveRuntimeConfig(payload.config as Partial<ArtistRuntimeConfig> | undefined);
      const result = await getAutopilotTicker().runNow(config);
      return {
        ...result.state,
        tickerOutcome: result.outcome,
        tickerLastTickAt: getLastTickAt()
      };
    }
  });

  safeRegisterRoute(api, {
    method: "POST",
    path: "/plugins/artist-runtime/api/songs/ideate",
    handler: async (input) => {
      const payload = payloadRecord(input);
      const config = applyConfigDefaults(payload.config as Partial<ArtistRuntimeConfig> | undefined);
      return createSongIdea({
        workspaceRoot: config.artist.workspaceRoot,
        title: typeof payload.title === "string" ? payload.title : undefined,
        artistReason: typeof payload.artistReason === "string" ? payload.artistReason : undefined,
        config
      });
    }
  });

  safeRegisterRoute(api, {
    method: "POST",
    path: "/plugins/artist-runtime/api/songs/:songId/select-take",
    handler: async (input) => {
      const payload = payloadRecord(input);
      const config = applyConfigDefaults(payload.config as Partial<ArtistRuntimeConfig> | undefined);
      return selectTake({
        workspaceRoot: config.artist.workspaceRoot,
        songId: typeof payload.songId === "string" ? payload.songId : "song-001",
        runId: typeof payload.runId === "string" ? payload.runId : undefined,
        selectedTakeId: typeof payload.selectedTakeId === "string" ? payload.selectedTakeId : undefined,
        reason: typeof payload.reason === "string" ? payload.reason : undefined
      });
    }
  });

  safeRegisterRoute(api, {
    method: "POST",
    path: "/plugins/artist-runtime/api/songs/:songId/social-assets",
    handler: async (input) => {
      const payload = payloadRecord(input);
      const config = applyConfigDefaults(payload.config as Partial<ArtistRuntimeConfig> | undefined);
      return prepareSocialAssets({
        workspaceRoot: config.artist.workspaceRoot,
        songId: typeof payload.songId === "string" ? payload.songId : "song-001",
        config
      });
    }
  });
}

const PLUGIN_ROOT = (() => {
  try {
    return join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  } catch {
    return process.cwd();
  }
})();

export async function uiBuildIsFresh(projectRoot = PLUGIN_ROOT): Promise<boolean> {
  const uiRoot = join(projectRoot, "ui");
  const distIndexPath = join(uiRoot, "dist", "index.html");
  const distIndexStat = await stat(distIndexPath).catch(() => undefined);
  if (!distIndexStat) {
    return false;
  }

  const sourcePaths = [
    join(uiRoot, "index.html"),
    join(uiRoot, "package.json"),
    join(uiRoot, "vite.config.ts"),
    join(uiRoot, "src", "App.tsx"),
    join(uiRoot, "src", "main.tsx"),
    join(uiRoot, "src", "styles.css")
  ];
  const sourceStats = await Promise.all(sourcePaths.map(async (path) => stat(path).catch(() => undefined)));
  return sourceStats.every((sourceStat) => !sourceStat || sourceStat.mtimeMs <= distIndexStat.mtimeMs);
}

function stripUiBasePath(assetPath: string): string {
  return assetPath.replace(/^\/plugins\/artist-runtime\/ui\//, "").replace(/^\//, "");
}

async function builtProducerConsoleHtml(projectRoot = PLUGIN_ROOT): Promise<string | undefined> {
  try {
    if (!(await uiBuildIsFresh(projectRoot))) {
      return undefined;
    }

    const uiRoot = join(projectRoot, "ui", "dist");
    const indexHtml = await readFile(join(uiRoot, "index.html"), "utf8");
    const cssMatches = Array.from(indexHtml.matchAll(/<link[^>]+href="([^"]+\.css)"[^>]*>/g)).map((match) => match[1]);
    const scriptMatches = Array.from(indexHtml.matchAll(/<script[^>]+src="([^"]+\.js)"[^>]*><\/script>/g)).map((match) => match[1]);
    const cssChunks = await Promise.all(cssMatches.map(async (href) => readFile(join(uiRoot, stripUiBasePath(href)), "utf8")));
    const scriptChunks = await Promise.all(scriptMatches.map(async (src) => readFile(join(uiRoot, stripUiBasePath(src)), "utf8")));

    return indexHtml
      .replace(/<link[^>]+href="[^"]+\.css"[^>]*>/g, "")
      .replace(/<script[^>]+src="[^"]+\.js"[^>]*><\/script>/g, "")
      .replace("</head>", `<style>${cssChunks.join("\n")}</style></head>`)
      .replace("</body>", `<script type="module">${scriptChunks.join("\n")}</script></body>`);
  } catch {
    return undefined;
  }
}

export async function producerConsoleHtml(): Promise<string> {
  const built = await builtProducerConsoleHtml();
  if (built) {
    return built;
  }

  return [
    "<!doctype html>",
    "<meta charset=\"utf-8\">",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
    "<title>Artist Runtime</title>",
    "<style>",
    ":root{--bg:#f4efe7;--ink:#1d1a17;--muted:#6c6257;--line:#d5cabc;--card:#fbf7f1;--accent:#9d4f2e;--accent2:#224d4a;font-family:Georgia,'Iowan Old Style',serif}",
    "body{margin:0;background:radial-gradient(circle at top,#fff8ef,transparent 35%),linear-gradient(180deg,#f4efe7,#e8dfd3);color:var(--ink)}",
    "main{max-width:1120px;margin:0 auto;padding:32px 20px 64px}",
    "header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:24px}",
    "h1{margin:0;font-size:clamp(2rem,4vw,3.5rem);letter-spacing:.02em}",
    "p{color:var(--muted)}",
    ".actions{display:flex;gap:8px;flex-wrap:wrap}",
    "button{border:1px solid var(--line);background:var(--card);padding:10px 14px;border-radius:999px;cursor:pointer}",
    "button.primary{background:var(--accent);color:#fff;border-color:var(--accent)}",
    ".grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}",
    ".panel{background:rgba(251,247,241,.88);border:1px solid var(--line);border-radius:20px;padding:18px;box-shadow:0 8px 30px rgba(61,40,20,.05)}",
    ".metric{font-size:1.8rem;margin:8px 0 0}",
    ".list{display:grid;gap:10px;margin-top:10px}",
    ".item{padding:12px;border-radius:14px;background:#fff;border:1px solid #e4d8cb}",
    ".config-form{display:grid;gap:10px}",
    ".field-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}",
    ".toggle{display:flex;align-items:center;gap:10px}",
    ".warning{padding:12px;border-radius:14px;background:#f4e3c4;color:#996400;border:1px solid rgba(153,100,0,.24)}",
    ".field-error{color:#8f2016;font-weight:600}",
    ".pill{display:inline-block;padding:4px 8px;border-radius:999px;background:#efe2d6;color:var(--accent);font-size:.8rem;margin-right:6px}",
    ".alert{border-left:4px solid var(--accent);padding-left:12px}",
    ".alert.warning{border-color:#a06b08}",
    ".alert.critical{border-color:#8c1d18}",
    ".muted{color:var(--muted)}",
    "pre{white-space:pre-wrap;background:#fff;border:1px solid var(--line);padding:12px;border-radius:14px;overflow:auto}",
    "</style>",
    "<main>",
    "<header><div><p class=\"muted\">Producer Console</p><h1>Artist Runtime</h1><p>Runtime-first control tower for status, songs, alerts, and cycle actions.</p></div><div class=\"actions\"><button id=\"pause\">Pause</button><button id=\"resume\">Resume</button><button class=\"primary\" id=\"run-cycle\">Run Cycle Now</button></div></header>",
    "<section class=\"grid\">",
    "<article class=\"panel\"><div class=\"muted\">Autopilot</div><div class=\"metric\" id=\"autopilot-stage\">-</div><div id=\"autopilot-meta\" class=\"muted\"></div></article>",
    "<article class=\"panel\"><div class=\"muted\">Ticker</div><div class=\"metric\" id=\"ticker-outcome\">-</div><div id=\"ticker-meta\" class=\"muted\"></div></article>",
    "<article class=\"panel\"><div class=\"muted\">Suno</div><div class=\"metric\" id=\"suno-state\">-</div><div id=\"suno-meta\" class=\"muted\"></div></article>",
    "<article class=\"panel\"><div class=\"muted\">Music Budget</div><div class=\"metric\" id=\"music-budget\">-</div><div id=\"music-meta\" class=\"muted\"></div></article>",
    "<article class=\"panel\"><div class=\"muted\">Distribution</div><div class=\"metric\" id=\"distribution-meta\">-</div><div id=\"platform-meta\" class=\"muted\"></div></article>",
    "</section>",
    "<section class=\"grid\" style=\"margin-top:16px\">",
    "<article class=\"panel\"><div class=\"muted\">Songs</div><div id=\"songs\" class=\"list\"></div></article>",
    "<article class=\"panel\"><div class=\"muted\">Alerts</div><div id=\"alerts\" class=\"list\"></div></article>",
    "<article class=\"panel\"><div class=\"muted\">Current Song Detail</div><div id=\"song-detail\" class=\"list\"></div></article>",
    "</section>",
    "<section class=\"grid\" style=\"margin-top:16px\">",
    "<article class=\"panel\"><div class=\"muted\">Recent X Result</div><div id=\"recent-x-result\" class=\"list\"></div></article>",
    "<article class=\"panel\"><div class=\"muted\">Simulate Reply</div><form id=\"reply-form\" class=\"list\"><input id=\"reply-target\" placeholder=\"target tweet id or URL\" /><textarea id=\"reply-text\" placeholder=\"reply text\" rows=\"4\"></textarea><button class=\"primary\" type=\"submit\">Simulate Dry-Run Reply</button></form></article>",
    "</section>",
    "<section class=\"grid\" style=\"margin-top:16px\">",
    "<article class=\"panel\"><div class=\"muted\">Config Editor</div><form id=\"config-form\" class=\"config-form\"><label class=\"toggle\"><input id=\"cfg-autopilot-enabled\" type=\"checkbox\" />Autopilot enabled</label><label class=\"toggle\"><input id=\"cfg-dry-run\" type=\"checkbox\" />Dry-run safety</label><div id=\"cfg-dry-run-warning\" class=\"warning\" hidden>Dry-run is OFF. The runtime stays fail-closed, but this arm can permit live side effects if the connectors are ready.</div><div class=\"field-grid\"><label><div class=\"muted\">Songs Per Week</div><input id=\"cfg-songs-per-week\" type=\"number\" min=\"0\" max=\"21\" /></label><label><div class=\"muted\">Cycle Interval Minutes</div><input id=\"cfg-cycle-interval\" type=\"number\" min=\"15\" max=\"1440\" /></label></div><label class=\"toggle\"><input id=\"cfg-x-enabled\" type=\"checkbox\" />X enabled</label><label class=\"toggle\"><input id=\"cfg-instagram-enabled\" type=\"checkbox\" />Instagram enabled</label><label class=\"toggle\"><input id=\"cfg-tiktok-enabled\" type=\"checkbox\" />TikTok enabled</label><div class=\"muted\" id=\"cfg-meta\"></div><div id=\"config-error\" class=\"field-error\"></div><div class=\"actions\"><button class=\"primary\" id=\"config-save\" type=\"submit\">Save Settings</button><button id=\"config-reset\" type=\"button\">Reset Draft</button><button id=\"config-refresh\" type=\"button\">Refresh</button></div></form></article>",
    "</section>",
    "<section class=\"panel\" style=\"margin-top:16px\"><div class=\"muted\">API Debug</div><pre id=\"debug\">loading...</pre></section>",
    "<script type=\"module\">",
    "const base='/plugins/artist-runtime/api';",
    "let configDirty=false;",
    "async function get(path){const res=await fetch(base+path);if(!res.ok) throw new Error(path+' '+res.status);return res.json();}",
    "async function post(path,body={}){const res=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});if(!res.ok) throw new Error(path+' '+res.status);return res.json();}",
    "function text(id,value){document.getElementById(id).textContent=value;}",
    "function html(id,value){document.getElementById(id).innerHTML=value;}",
    "function checked(id){return document.getElementById(id).checked;}",
    "function value(id){return document.getElementById(id).value;}",
    "function renderSongs(songs){html('songs',songs.length?songs.map(song=>`<div class=\"item\"><span class=\"pill\">${song.status}</span><strong>${song.title}</strong><div class=\"muted\">${song.songId} · runs ${song.runCount}</div></div>`).join(''):'<div class=\"item muted\">No songs yet.</div>')}",
    "function renderAlerts(alerts){html('alerts',alerts.length?alerts.map(alert=>`<div class=\"item alert ${alert.severity}\"><strong>${alert.message}</strong><div class=\"muted\">${alert.source}${alert.ackedAt?' · acknowledged':''}</div></div>`).join(''):'<div class=\"item muted\">No active alerts.</div>')}",
    "function renderSongDetail(detail){if(!detail||!detail.song){html('song-detail','<div class=\"item muted\">No current song.</div>');return;} html('song-detail',`<div class=\"item\"><strong>${detail.song.title}</strong><div class=\"muted\">${detail.song.songId} · ${detail.song.status}</div></div><div class=\"item\"><div class=\"muted\">Prompt Ledger</div><strong>${detail.promptLedger.length} entries</strong></div><div class=\"item\"><div class=\"muted\">Suno Runs</div><strong>${detail.sunoRuns.length}</strong></div><div class=\"item\"><div class=\"muted\">Latest Prompt Pack</div><strong>${detail.latestPromptPack?`v${detail.latestPromptPack.version}`:'none'}</strong></div>`)}",
    "function renderRecentX(status){const action=status.lastSocialAction; if(!action||action.platform!=='x'){html('recent-x-result','<div class=\"item muted\">No X result yet.</div>'); return;} html('recent-x-result',`<div class=\"item\"><strong>${action.action}</strong><div class=\"muted\">${action.accepted?'accepted':'blocked'} · ${action.reason??'no reason'}</div><div class=\"muted\">${action.url??'no url'}</div></div>`)}",
    "function syncConfigForm(config){if(configDirty) return; document.getElementById('cfg-autopilot-enabled').checked=Boolean(config.autopilot.enabled); document.getElementById('cfg-dry-run').checked=Boolean(config.autopilot.dryRun); document.getElementById('cfg-songs-per-week').value=String(config.autopilot.songsPerWeek ?? 0); document.getElementById('cfg-cycle-interval').value=String(config.autopilot.cycleIntervalMinutes ?? 180); document.getElementById('cfg-x-enabled').checked=Boolean(config.distribution.platforms.x.enabled); document.getElementById('cfg-instagram-enabled').checked=Boolean(config.distribution.platforms.instagram.enabled); document.getElementById('cfg-tiktok-enabled').checked=Boolean(config.distribution.platforms.tiktok.enabled); text('cfg-meta',`artist ${config.artist.artistId} · workspace ${config.artist.workspaceRoot}`); document.getElementById('cfg-dry-run-warning').hidden=Boolean(config.autopilot.dryRun); text('config-error','');}",
    "function buildConfigPatch(){const songsPerWeek=Number(value('cfg-songs-per-week')); const cycleIntervalMinutes=Number(value('cfg-cycle-interval')); if(!Number.isInteger(songsPerWeek)||songsPerWeek<0||songsPerWeek>21) throw new Error('songsPerWeek must be between 0 and 21'); if(!Number.isInteger(cycleIntervalMinutes)||cycleIntervalMinutes<15||cycleIntervalMinutes>1440) throw new Error('cycleIntervalMinutes must be between 15 and 1440'); return {autopilot:{enabled:checked('cfg-autopilot-enabled'),dryRun:checked('cfg-dry-run'),songsPerWeek,cycleIntervalMinutes},distribution:{platforms:{x:{enabled:checked('cfg-x-enabled')},instagram:{enabled:checked('cfg-instagram-enabled')},tiktok:{enabled:checked('cfg-tiktok-enabled')}}}};}",
    "async function refresh(){const [status,songs,alerts,config]=await Promise.all([get('/status'),get('/songs'),get('/alerts'),get('/config')]); text('autopilot-stage',status.autopilot.stage); text('autopilot-meta',`${status.autopilot.nextAction} · run ${status.autopilot.currentRunId??'none'}`); text('ticker-outcome',status.ticker.lastOutcome??'never'); text('ticker-meta',status.ticker.lastTickAt?`${status.ticker.lastTickAt} · ${status.ticker.intervalMs}ms`:`interval ${status.ticker.intervalMs}ms`); text('suno-state',status.sunoWorker.state); text('suno-meta',status.sunoWorker.hardStopReason??'worker ready'); text('music-budget',`${status.musicSummary.monthlyRuns}/${status.musicSummary.monthlyGenerationBudget}`); text('music-meta',`today ${status.musicSummary.dailyRuns} · prompt pack ${status.musicSummary.latestPromptPackVersion??'none'}`); text('distribution-meta',`posts ${status.distributionSummary.postsToday} · replies ${status.distributionSummary.repliesToday}`); text('platform-meta',Object.entries(status.platforms).map(([id,p])=>`${id}:${p.connected?'connected':'offline'}`).join(' · ')); renderSongs(songs); renderAlerts(alerts); renderRecentX(status); syncConfigForm(config); if(status.recentSong){document.getElementById('reply-form').dataset.songId=status.recentSong.songId; renderSongDetail(await get('/songs/'+status.recentSong.songId));} else {document.getElementById('reply-form').dataset.songId=''; renderSongDetail(null);} text('debug',JSON.stringify(status,null,2)); }",
    "document.getElementById('pause').addEventListener('click',async()=>{await post('/pause');await refresh();});",
    "document.getElementById('resume').addEventListener('click',async()=>{await post('/resume');await refresh();});",
    "document.getElementById('run-cycle').addEventListener('click',async()=>{await post('/run-cycle');await refresh();});",
    "document.getElementById('reply-form').addEventListener('submit',async(event)=>{event.preventDefault(); const songId=event.currentTarget.dataset.songId; if(!songId) return; await post('/platforms/x/simulate-reply',{songId,targetId:document.getElementById('reply-target').value,text:document.getElementById('reply-text').value}); await refresh();});",
    "document.querySelectorAll('#config-form input').forEach((input)=>input.addEventListener('input',()=>{configDirty=true; document.getElementById('cfg-dry-run-warning').hidden=checked('cfg-dry-run');}));",
    "document.getElementById('config-form').addEventListener('submit',async(event)=>{event.preventDefault(); try{text('config-error',''); await post('/config/update',{patch:buildConfigPatch()}); configDirty=false; await refresh();}catch(error){text('config-error',String(error instanceof Error ? error.message : error));}});",
    "document.getElementById('config-reset').addEventListener('click',async()=>{configDirty=false; await refresh();});",
    "document.getElementById('config-refresh').addEventListener('click',async()=>{configDirty=false; await refresh();});",
    "setInterval(()=>{void refresh().catch(error=>{text('debug',String(error));});},3000);",
    "refresh().catch(error=>{text('debug',String(error));});",
    "</script>",
    "</main>"
  ].join("");
}
