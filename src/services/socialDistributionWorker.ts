import type { ArtistRuntimeConfig } from "../types.js";
import { applyConfigDefaults } from "../config/schema.js";
import { listSongStates } from "./artistState.js";
import { readLatestSocialAction } from "./socialPublishing.js";

export class SocialDistributionWorker {
  async status(config?: Partial<ArtistRuntimeConfig>) {
    const resolved = applyConfigDefaults(config);
    const songs = await listSongStates(resolved.artist.workspaceRoot);
    const recentSong = songs[0];
    const lastAction = recentSong ? await readLatestSocialAction(resolved.artist.workspaceRoot, recentSong.songId) : undefined;
    return {
      enabled: resolved.distribution.enabled,
      dryRun: resolved.autopilot.dryRun,
      lastSongId: recentSong?.songId,
      lastAction,
      blockedReason: resolved.distribution.enabled ? undefined : "distribution disabled"
    };
  }
}
