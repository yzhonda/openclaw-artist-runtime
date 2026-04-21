import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { applyConfigDefaults } from "../config/schema.js";
import { defaultArtistRuntimeConfig } from "../config/defaultConfig.js";
import { InstagramConnector } from "../connectors/social/instagramConnector.js";
import { TikTokConnector } from "../connectors/social/tiktokConnector.js";
import { XBirdConnector } from "../connectors/social/xBirdConnector.js";
import { BrowserWorkerSunoConnector } from "../connectors/suno/browserWorkerConnector.js";
import { safeRegisterRoute } from "../pluginApi.js";
import { listSongStates } from "../services/artistState.js";
import { ArtistAutopilotService } from "../services/autopilotService.js";
import { inspectAuditLog } from "../services/auditLog.js";
import { inspectJsonlFile } from "../services/promptLedger.js";
import { readLatestSocialAction } from "../services/socialPublishing.js";
import { readLatestSunoRun } from "../services/sunoRuns.js";
import type { ArtistRuntimeConfig, StatusResponse } from "../types.js";

async function buildWorkspaceSummaries(workspaceRoot: string): Promise<Pick<StatusResponse, "recentSong" | "lastSunoRun" | "lastSocialAction" | "alerts">> {
  const recentSong = (await listSongStates(workspaceRoot))[0];
  if (!recentSong) {
    return { alerts: [] };
  }

  const alerts: string[] = [];
  const promptLedgerHealth = await inspectJsonlFile(join(workspaceRoot, "songs", recentSong.songId, "prompts", "prompt-ledger.jsonl"));
  if (!promptLedgerHealth.healthy) {
    alerts.push(`Prompt ledger unhealthy for ${recentSong.songId}`);
  }

  const socialLedgerHealth = await inspectAuditLog(join(workspaceRoot, "songs", recentSong.songId, "social", "social-publish.jsonl"));
  if (!socialLedgerHealth.healthy) {
    alerts.push(`Social ledger unhealthy for ${recentSong.songId}`);
  }

  const auditHealth = await inspectAuditLog(join(workspaceRoot, "songs", recentSong.songId, "audit", "actions.jsonl"));
  if (!auditHealth.healthy) {
    alerts.push(`Audit log unhealthy for ${recentSong.songId}`);
  }

  return {
    recentSong,
    lastSunoRun: await readLatestSunoRun(workspaceRoot, recentSong.songId),
    lastSocialAction: await readLatestSocialAction(workspaceRoot, recentSong.songId),
    alerts
  };
}

export async function buildStatusResponse(config?: Partial<ArtistRuntimeConfig>): Promise<StatusResponse> {
  const mergedConfig = applyConfigDefaults(config);
  const autopilot = new ArtistAutopilotService().status(mergedConfig.autopilot.enabled, mergedConfig.autopilot.dryRun);
  const sunoWorker = await new BrowserWorkerSunoConnector().status();
  const xConnector = new XBirdConnector();
  const instagramConnector = new InstagramConnector();
  const tiktokConnector = new TikTokConnector();
  const workspaceStatus = await buildWorkspaceSummaries(mergedConfig.artist.workspaceRoot);
  const enabledPlatformAlerts = (
    await Promise.all(
      (Object.entries(mergedConfig.distribution.platforms) as Array<[keyof ArtistRuntimeConfig["distribution"]["platforms"], ArtistRuntimeConfig["distribution"]["platforms"][keyof ArtistRuntimeConfig["distribution"]["platforms"]]]>).map(
        async ([platform, platformConfig]) => {
          if (!platformConfig.enabled) {
            return [];
          }
          const connector = platform === "x" ? xConnector : platform === "instagram" ? instagramConnector : tiktokConnector;
          const capabilitySummary = await connector.checkCapabilities();
          const supported = [
            capabilitySummary.textPost,
            capabilitySummary.imagePost,
            capabilitySummary.videoPost,
            capabilitySummary.carouselPost,
            capabilitySummary.reelPost
          ].some((capability) => capability === true);
          return supported ? [] : [`${platform} is enabled but has no confirmed publish capability`];
        }
      )
    )
  ).flat();

  return {
    config: mergedConfig,
    dryRun: mergedConfig.autopilot.dryRun,
    autopilot,
    sunoWorker,
    platforms: {
      x: {
        connected: (await xConnector.checkConnection()).connected,
        authority: mergedConfig.distribution.platforms.x.authority,
        capabilitySummary: await xConnector.checkCapabilities()
      },
      instagram: {
        connected: (await instagramConnector.checkConnection()).connected,
        authority: mergedConfig.distribution.platforms.instagram.authority,
        capabilitySummary: await instagramConnector.checkCapabilities()
      },
      tiktok: {
        connected: (await tiktokConnector.checkConnection()).connected,
        authority: mergedConfig.distribution.platforms.tiktok.authority,
        capabilitySummary: await tiktokConnector.checkCapabilities()
      }
    },
    alerts: [...workspaceStatus.alerts, ...(sunoWorker.hardStopReason ? [sunoWorker.hardStopReason] : []), ...enabledPlatformAlerts],
    recentSong: workspaceStatus.recentSong,
    lastSunoRun: workspaceStatus.lastSunoRun,
    lastSocialAction: workspaceStatus.lastSocialAction
  };
}

export function registerRoutes(api: unknown): void {
  safeRegisterRoute(api, {
    method: "GET",
    path: "/plugins/artist-runtime",
    handler: () => producerConsoleHtml()
  });

  safeRegisterRoute(api, {
    method: "GET",
    path: "/plugins/artist-runtime/api/status",
    handler: async () => buildStatusResponse(defaultArtistRuntimeConfig)
  });
}

export function producerConsoleHtml(): string {
  return "<!doctype html><title>Artist Runtime</title><main><h1>Artist Runtime Producer Console</h1><p>Setup, status, ledgers, and recovery.</p></main>";
}
