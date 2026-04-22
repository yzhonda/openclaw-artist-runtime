import type { ArtistRuntimeConfig } from "../types.js";

export const defaultArtistRuntimeConfig: ArtistRuntimeConfig = {
  artist: {
    mode: "public_artist",
    artistId: "artist",
    profilePath: "ARTIST.md",
    workspaceRoot: "."
  },
  autopilot: {
    enabled: false,
    dryRun: true,
    songsPerWeek: 3,
    cycleIntervalMinutes: 180,
    producerDigest: "daily"
  },
  music: {
    engine: "suno",
    suno: {
      enabled: true,
      connectionMode: "background_browser_worker",
      driver: "mock",
      submitMode: "skip",
      authority: "auto_create_and_select_take",
      monthlyGenerationBudget: 50,
      maxGenerationsPerDay: 4,
      minMinutesBetweenCreates: 20,
      stopOnLoginChallenge: true,
      stopOnCaptcha: true,
      stopOnPaymentPrompt: true,
      promptLogging: "full"
    }
  },
  distribution: {
    enabled: false,
    dailySharing: "auto",
    officialRelease: "manual_approval",
    platforms: {
      x: {
        enabled: false,
        connector: "bird",
        authority: "auto_publish",
        maxPostsPerDay: 3,
        maxRepliesPerDay: 0,
        autoPostTypes: ["observation", "studio_note", "lyric_fragment", "demo_teaser", "new_song_link"]
      },
      instagram: {
        enabled: false,
        connector: "instagram_content_publishing",
        authority: "auto_publish_visuals",
        maxPostsPerDay: 1,
        autoPostTypes: ["lyric_card", "reel_teaser", "cover_visual"]
      },
      tiktok: {
        enabled: false,
        connector: "tiktok_content_posting",
        authority: "auto_publish_clips",
        maxPostsPerDay: 1,
        autoPostTypes: ["hook_clip", "demo_teaser"]
      }
    }
  },
  safety: {
    auditLog: true,
    failClosed: true,
    forbiddenTopics: ["politics", "medical", "financial", "religion", "private_individuals", "legal_claims"],
    forbidCaptchaBypass: true,
    forbidCredentialLogging: true,
    requireApprovalForHighRisk: true
  }
};
