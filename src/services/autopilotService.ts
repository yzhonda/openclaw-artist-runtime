import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { applyConfigDefaults } from "../config/schema.js";
import type { AutopilotRunState, AutopilotStage, AutopilotStatus, ArtistRuntimeConfig, SongState } from "../types.js";
import { listSongStates, readSongState } from "./artistState.js";
import { createSongIdea } from "./songIdeation.js";
import { draftLyrics } from "./lyricsDrafting.js";
import { prepareSocialAssets } from "./socialAssets.js";
import { createAndPersistSunoPromptPack } from "./sunoPromptPackFiles.js";
import { generateSunoRun } from "./sunoRuns.js";
import { publishSocialAction } from "./socialPublishing.js";
import { selectTake } from "./takeSelection.js";

const defaultAutopilotState: AutopilotRunState = {
  stage: "idle",
  paused: false,
  retryCount: 0,
  cycleCount: 0,
  updatedAt: new Date().toISOString()
};

export interface AutopilotTickInput {
  enabled: boolean;
  dryRun: boolean;
  paused?: boolean;
  hardStop?: boolean;
  promptPackReady?: boolean;
  takeSelected?: boolean;
  assetsReady?: boolean;
}

export interface RunAutopilotCycleInput {
  workspaceRoot: string;
  config?: Partial<ArtistRuntimeConfig>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function getAutopilotStatePath(root: string): string {
  return join(root, "runtime", "autopilot-state.json");
}

async function writeAutopilotState(root: string, state: AutopilotRunState): Promise<AutopilotRunState> {
  const nextState = { ...state, updatedAt: nowIso() };
  await mkdir(join(root, "runtime"), { recursive: true });
  await writeFile(getAutopilotStatePath(root), `${JSON.stringify(nextState, null, 2)}\n`, "utf8");
  return nextState;
}

export async function readAutopilotRunState(root: string): Promise<AutopilotRunState> {
  const contents = await readFile(getAutopilotStatePath(root), "utf8").catch(() => "");
  if (!contents) {
    return { ...defaultAutopilotState };
  }
  return { ...defaultAutopilotState, ...(JSON.parse(contents) as Partial<AutopilotRunState>) };
}

export async function pauseAutopilot(root: string, reason = "paused by operator"): Promise<AutopilotRunState> {
  const current = await readAutopilotRunState(root);
  return writeAutopilotState(root, {
    ...current,
    paused: true,
    pausedReason: reason,
    stage: "paused"
  });
}

export async function resumeAutopilot(root: string): Promise<AutopilotRunState> {
  const current = await readAutopilotRunState(root);
  return writeAutopilotState(root, {
    ...current,
    paused: false,
    pausedReason: undefined,
    hardStopReason: undefined,
    stage: "idle"
  });
}

function nextActionForStage(stage: AutopilotStage): string {
  switch (stage) {
    case "planning":
      return "decide_next_song";
    case "prompt_pack":
      return "create_or_validate_prompt_pack";
    case "suno_generation":
      return "create_or_wait_for_suno_run";
    case "take_selection":
      return "select_best_take";
    case "asset_generation":
      return "prepare_social_assets";
    case "publishing":
      return "publish_distribution_set";
    case "completed":
      return "idle";
    case "paused":
      return "await_manual_resume";
    case "failed_closed":
      return "surface_alert";
    default:
      return "idle";
  }
}

function stageFromSong(song?: SongState): AutopilotStage {
  if (!song) {
    return "planning";
  }
  switch (song.status) {
    case "idea":
    case "brief":
    case "lyrics":
      return "prompt_pack";
    case "suno_prompt_pack":
    case "suno_running":
    case "takes_imported":
      return song.status === "takes_imported" ? "take_selection" : "suno_generation";
    case "take_selected":
      return "asset_generation";
    case "social_assets":
      return "publishing";
    case "published":
      return "completed";
    case "archived":
    case "failed":
      return "failed_closed";
    default:
      return "planning";
  }
}

async function currentSong(root: string): Promise<SongState | undefined> {
  const songs = await listSongStates(root);
  return songs[0];
}

async function ensureLyrics(root: string, song: SongState): Promise<SongState> {
  if (song.status === "lyrics" || song.status === "suno_prompt_pack" || song.status === "suno_running" || song.status === "takes_imported" || song.status === "take_selected" || song.status === "social_assets" || song.status === "published") {
    return song;
  }
  await draftLyrics({ workspaceRoot: root, songId: song.songId });
  return readSongState(root, song.songId);
}

async function createPromptPackForSong(root: string, song: SongState, config?: Partial<ArtistRuntimeConfig>): Promise<SongState> {
  const readySong = await ensureLyrics(root, song);
  const lyricsVersion = readySong.lyricsVersion ?? 1;
  const lyricsPath = join(root, "songs", readySong.songId, "lyrics", `lyrics.v${lyricsVersion}.md`);
  const [lyricsText, briefText] = await Promise.all([
    readFile(lyricsPath, "utf8").catch(() => ""),
    readFile(join(root, "songs", readySong.songId, "brief.md"), "utf8").catch(() => "")
  ]);
  await createAndPersistSunoPromptPack({
    workspaceRoot: root,
    songId: readySong.songId,
    songTitle: readySong.title,
    artistReason: readySong.lastReason ?? "autopilot prompt pack",
    lyricsText: lyricsText || briefText || readySong.title,
    knowledgePackVersion: "local-dev",
    configSnapshot: config
  });
  return readSongState(root, readySong.songId);
}

async function choosePublishPlatform(config: ArtistRuntimeConfig): Promise<"x" | "instagram" | "tiktok"> {
  if (config.distribution.platforms.x.enabled) {
    return "x";
  }
  if (config.distribution.platforms.instagram.enabled) {
    return "instagram";
  }
  if (config.distribution.platforms.tiktok.enabled) {
    return "tiktok";
  }
  return "x";
}

export class ArtistAutopilotService {
  planNextStage(input: AutopilotTickInput): AutopilotStage {
    if (!input.enabled) {
      return "idle";
    }
    if (input.paused) {
      return "paused";
    }
    if (input.hardStop) {
      return "failed_closed";
    }
    if (!input.promptPackReady) {
      return "prompt_pack";
    }
    if (!input.takeSelected) {
      return "take_selection";
    }
    if (!input.assetsReady) {
      return "asset_generation";
    }
    return "publishing";
  }

  async runCycle(input: RunAutopilotCycleInput): Promise<AutopilotRunState> {
    const config = applyConfigDefaults(input.config);
    const existing = await readAutopilotRunState(input.workspaceRoot);
    if (!config.autopilot.enabled) {
      return writeAutopilotState(input.workspaceRoot, {
        ...existing,
        stage: "idle",
        blockedReason: "autopilot disabled by config",
        lastRunAt: nowIso()
      });
    }
    if (existing.paused) {
      return writeAutopilotState(input.workspaceRoot, {
        ...existing,
        stage: "paused",
        blockedReason: existing.pausedReason ?? "paused by operator",
        lastRunAt: nowIso()
      });
    }
    if (existing.hardStopReason) {
      return writeAutopilotState(input.workspaceRoot, {
        ...existing,
        stage: "failed_closed",
        blockedReason: existing.hardStopReason,
        lastRunAt: nowIso()
      });
    }

    const song = await currentSong(input.workspaceRoot);
    const stage = stageFromSong(song);
    const runId = existing.runId ?? `auto_${Date.now().toString(36)}`;
    const baseState: AutopilotRunState = {
      ...existing,
      runId,
      currentSongId: song?.songId,
      stage,
      lastRunAt: nowIso()
    };

    if (
      song
      && stage === "publishing"
      && existing.lastSuccessfulStage === "publishing"
      && config.autopilot.dryRun
      && existing.blockedReason?.includes("dry-run")
    ) {
      return writeAutopilotState(input.workspaceRoot, {
        ...baseState,
        currentSongId: song.songId,
        stage: "completed",
        blockedReason: existing.blockedReason,
        lastError: undefined,
        lastSuccessfulStage: "completed",
        cycleCount: existing.cycleCount + 1
      });
    }

    if (existing.runId === runId && existing.lastSuccessfulStage === stage && stage !== "planning") {
      return writeAutopilotState(input.workspaceRoot, baseState);
    }

    try {
      if (!song) {
        const idea = await createSongIdea({ workspaceRoot: input.workspaceRoot, config });
        return writeAutopilotState(input.workspaceRoot, {
          ...baseState,
          currentSongId: idea.songId,
          stage: "planning",
          blockedReason: undefined,
          lastError: undefined,
          lastSuccessfulStage: "planning",
          cycleCount: existing.cycleCount + 1
        });
      }

      switch (stage) {
        case "prompt_pack": {
          await createPromptPackForSong(input.workspaceRoot, song, config);
          return writeAutopilotState(input.workspaceRoot, {
            ...baseState,
            currentSongId: song.songId,
            stage: "prompt_pack",
            blockedReason: undefined,
            lastError: undefined,
            lastSuccessfulStage: "prompt_pack",
            cycleCount: existing.cycleCount + 1
          });
        }
        case "suno_generation": {
          const run = await generateSunoRun({ workspaceRoot: input.workspaceRoot, songId: song.songId, config });
          return writeAutopilotState(input.workspaceRoot, {
            ...baseState,
            currentSongId: song.songId,
            stage: "suno_generation",
            blockedReason: run.status === "accepted" || run.status === "blocked_dry_run" ? "waiting for Suno result import" : run.authorityDecision.reason,
            lastError: run.error?.message,
            lastSuccessfulStage: "suno_generation",
            cycleCount: existing.cycleCount + 1
          });
        }
        case "take_selection": {
          await selectTake({ workspaceRoot: input.workspaceRoot, songId: song.songId });
          return writeAutopilotState(input.workspaceRoot, {
            ...baseState,
            currentSongId: song.songId,
            stage: "take_selection",
            blockedReason: undefined,
            lastError: undefined,
            lastSuccessfulStage: "take_selection",
            cycleCount: existing.cycleCount + 1
          });
        }
        case "asset_generation": {
          await prepareSocialAssets({ workspaceRoot: input.workspaceRoot, songId: song.songId, config });
          return writeAutopilotState(input.workspaceRoot, {
            ...baseState,
            currentSongId: song.songId,
            stage: "asset_generation",
            blockedReason: undefined,
            lastError: undefined,
            lastSuccessfulStage: "asset_generation",
            cycleCount: existing.cycleCount + 1
          });
        }
        case "publishing": {
          const platform = await choosePublishPlatform(config);
          const assetPath = join(
            input.workspaceRoot,
            "songs",
            song.songId,
            "social",
            `${platform}-${platform === "x" ? "post" : "caption"}.md`
          );
          const text = await readFile(assetPath, "utf8").catch(() => song.title);
          const published = await publishSocialAction({
            workspaceRoot: input.workspaceRoot,
            songId: song.songId,
            platform,
            postType: platform === "x" ? "observation" : platform === "instagram" ? "lyric_card" : "hook_clip",
            text,
            config,
            action: "publish"
          });
          return writeAutopilotState(input.workspaceRoot, {
            ...baseState,
            currentSongId: song.songId,
            stage: "publishing",
            blockedReason: published.result.accepted ? undefined : published.result.reason,
            lastError: published.result.accepted ? undefined : published.result.reason,
            lastSuccessfulStage: "publishing",
            cycleCount: existing.cycleCount + 1
          });
        }
        case "completed": {
          return writeAutopilotState(input.workspaceRoot, {
            ...baseState,
            currentSongId: song.songId,
            stage: "completed",
            blockedReason: undefined,
            lastError: undefined,
            lastSuccessfulStage: "completed",
            cycleCount: existing.cycleCount + 1
          });
        }
        case "failed_closed": {
          return writeAutopilotState(input.workspaceRoot, {
            ...baseState,
            currentSongId: song.songId,
            stage: "failed_closed",
            hardStopReason: song.lastReason ?? "song marked failed",
            blockedReason: song.lastReason ?? "song marked failed"
          });
        }
        default:
          return writeAutopilotState(input.workspaceRoot, {
            ...baseState,
            stage: "planning",
            blockedReason: undefined,
            lastError: undefined,
            lastSuccessfulStage: "planning",
            cycleCount: existing.cycleCount + 1
          });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return writeAutopilotState(input.workspaceRoot, {
        ...baseState,
        stage: "failed_closed",
        hardStopReason: message,
        blockedReason: message,
        lastError: message,
        retryCount: existing.retryCount + 1
      });
    }
  }

  async tick(input: AutopilotTickInput): Promise<AutopilotStatus> {
    return {
      enabled: input.enabled,
      dryRun: input.dryRun,
      stage: this.planNextStage(input),
      nextAction: nextActionForStage(this.planNextStage(input))
    };
  }

  async status(enabled = false, dryRun = true, workspaceRoot?: string): Promise<AutopilotStatus> {
    const state = workspaceRoot ? await readAutopilotRunState(workspaceRoot) : { ...defaultAutopilotState };
    const stage = enabled ? state.stage : "idle";
    return {
      enabled,
      dryRun,
      stage,
      nextAction: nextActionForStage(stage),
      currentRunId: state.runId,
      currentSongId: state.currentSongId,
      lastSuccessfulStage: state.lastSuccessfulStage,
      pausedReason: state.pausedReason,
      hardStopReason: state.hardStopReason,
      blockedReason: state.blockedReason,
      lastError: state.lastError,
      retryCount: state.retryCount
    };
  }
}
