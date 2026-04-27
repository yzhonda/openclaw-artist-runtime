import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { applyConfigDefaults } from "../config/schema.js";
import type { AutopilotRunState, AutopilotStage, AutopilotStatus, ArtistRuntimeConfig, SocialPublishLedgerEntry, SocialPublishResult, SongState } from "../types.js";
import { AutopilotControlService } from "./autopilotControlService.js";
import {
  defaultAutopilotRunState,
  readAutopilotState,
  writeAutopilotState
} from "./autopilotRecovery.js";
import { listSongStates, readSongState, updateSongState } from "./artistState.js";
import { createSongIdea } from "./songIdeation.js";
import { draftLyrics } from "./lyricsDrafting.js";
import { prepareSocialAssets } from "./socialAssets.js";
import { createAndPersistSunoPromptPack } from "./sunoPromptPackFiles.js";
import { generateSunoRun } from "./sunoRuns.js";
import { publishSocialAction } from "./socialPublishing.js";
import { selectTake } from "./takeSelection.js";
import { emitRuntimeEvent } from "./runtimeEventBus.js";

export function isPublishBlockedByDryRun(
  result: Pick<SocialPublishResult, "accepted" | "dryRun">,
  entry: Pick<SocialPublishLedgerEntry, "policyDecision">
): boolean {
  if (result.accepted) {
    return false;
  }
  if (result.dryRun === true) {
    return true;
  }
  return entry.policyDecision?.policyDecision === "deny_dry_run";
}

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

function writeStageState(root: string, previous: AutopilotRunState, next: AutopilotRunState): Promise<AutopilotRunState> {
  if (previous.stage !== next.stage || previous.currentSongId !== next.currentSongId) {
    emitRuntimeEvent({
      type: "autopilot_stage_changed",
      songId: next.currentSongId,
      from: previous.stage,
      to: next.stage,
      timestamp: Date.now()
    });
  }
  return writeAutopilotRunState(root, next);
}

export async function writeAutopilotRunState(root: string, state: AutopilotRunState): Promise<AutopilotRunState> {
  return writeAutopilotState(root, state);
}

export async function readAutopilotRunState(root: string): Promise<AutopilotRunState> {
  return readAutopilotState(root);
}

export async function pauseAutopilot(root: string, reason = "paused by operator"): Promise<AutopilotRunState> {
  return new AutopilotControlService().pause(root, reason);
}

export async function resumeAutopilot(root: string): Promise<AutopilotRunState> {
  return new AutopilotControlService().resume(root);
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
  return songs.find((song) => song.status !== "scheduled" && song.status !== "published" && song.status !== "archived" && song.status !== "failed");
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
      return writeStageState(input.workspaceRoot, existing, {
        ...existing,
        stage: "idle",
        blockedReason: "autopilot disabled by config",
        lastRunAt: nowIso()
      });
    }
    if (existing.paused) {
      return writeStageState(input.workspaceRoot, existing, {
        ...existing,
        stage: "paused",
        blockedReason: existing.pausedReason ?? "paused by operator",
        lastRunAt: nowIso()
      });
    }
    if (existing.hardStopReason) {
      return writeStageState(input.workspaceRoot, existing, {
        ...existing,
        stage: "failed_closed",
        blockedReason: existing.hardStopReason,
        lastRunAt: nowIso()
      });
    }

    const song = await currentSong(input.workspaceRoot);
    const stage = stageFromSong(song);
    const runId = !song && existing.lastSuccessfulStage === "completed"
      ? `auto_${Date.now().toString(36)}`
      : existing.runId ?? `auto_${Date.now().toString(36)}`;
    const baseState: AutopilotRunState = {
      ...existing,
      runId,
      currentSongId: song?.songId,
      stage,
      lastRunAt: nowIso()
    };

    if (
      !song
      && existing.lastSuccessfulStage === "publishing"
      && config.autopilot.dryRun
      && existing.blockedReason?.includes("dry-run")
    ) {
      return writeStageState(input.workspaceRoot, existing, {
        ...baseState,
        currentSongId: existing.currentSongId,
        stage: "completed",
        blockedReason: existing.blockedReason,
        lastError: undefined,
        lastSuccessfulStage: "completed",
        cycleCount: existing.cycleCount + 1
      });
    }

    if (
      song
      && stage === "publishing"
      && existing.lastSuccessfulStage === "publishing"
      && config.autopilot.dryRun
      && existing.blockedReason?.includes("dry-run")
    ) {
      return writeStageState(input.workspaceRoot, existing, {
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
      return writeStageState(input.workspaceRoot, existing, baseState);
    }

    try {
      if (!song) {
        const idea = await createSongIdea({ workspaceRoot: input.workspaceRoot, config });
        return writeStageState(input.workspaceRoot, existing, {
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
          return writeStageState(input.workspaceRoot, existing, {
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
          return writeStageState(input.workspaceRoot, existing, {
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
          return writeStageState(input.workspaceRoot, existing, {
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
          return writeStageState(input.workspaceRoot, existing, {
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
          if (config.autopilot.dryRun && isPublishBlockedByDryRun(published.result, published.entry)) {
            await updateSongState(input.workspaceRoot, song.songId, {
              status: "published",
              reason: `dry-run publish simulated: ${published.result.reason}`
            });
          }
          return writeStageState(input.workspaceRoot, existing, {
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
          return writeStageState(input.workspaceRoot, existing, {
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
          return writeStageState(input.workspaceRoot, existing, {
            ...baseState,
            currentSongId: song.songId,
            stage: "failed_closed",
            hardStopReason: song.lastReason ?? "song marked failed",
            blockedReason: song.lastReason ?? "song marked failed"
          });
        }
        default:
          return writeStageState(input.workspaceRoot, existing, {
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
      emitRuntimeEvent({
        type: "error",
        source: "autopilot",
        reason: message,
        songId: baseState.currentSongId,
        timestamp: Date.now()
      });
      return writeStageState(input.workspaceRoot, existing, {
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
    const state = workspaceRoot ? await readAutopilotRunState(workspaceRoot) : { ...defaultAutopilotRunState };
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
