export type PlatformAuthority =
  | "disabled"
  | "draft_only"
  | "auto_publish"
  | "auto_publish_visuals"
  | "auto_publish_clips"
  | "auto_posts_and_low_risk_replies"
  | "full_social_autonomy";

export type SunoAuthority =
  | "prepare_only"
  | "autofill_only"
  | "auto_create_with_budget"
  | "auto_create_and_select_take";

export type ArtistRuntimeConfig = {
  workspace: { path: string };
  artist: { mode: "public_artist"; profilePath: string };
  autopilot: {
    enabled: boolean;
    cadence: "manual" | "daily" | "twice_daily" | "active";
    maxSongsPerWeek: number;
    preferredWorkWindows: string[];
    quietWindows: string[];
  };
  music: {
    engine: "suno";
    suno: {
      connectionMode: "manual_copy" | "background_browser_worker" | "api_provider";
      authority: SunoAuthority;
      monthlyGenerationBudget: number;
      maxGenerationsPerDay: number;
      minMinutesBetweenCreates: number;
      promptLogging: "full";
      browserProfilePath: string;
    };
  };
  publicPresence: {
    platforms: {
      x: { enabled: boolean; connector: "bird"; authority: PlatformAuthority; maxPostsPerDay: number; maxRepliesPerDay: number };
      instagram: { enabled: boolean; connector: "instagram_api"; authority: PlatformAuthority; maxPostsPerDay: number };
      tiktok: { enabled: boolean; connector: "tiktok_content_posting"; authority: PlatformAuthority; maxPostsPerDay: number };
    };
  };
  distribution: { dailySharing: "off" | "auto"; officialRelease: "manual_approval" | "auto_with_policy" };
  safety: {
    stopOnCaptcha: boolean;
    stopOnLoginChallenge: boolean;
    stopOnPaymentPrompt: boolean;
    stopOnUiMismatch: boolean;
    pauseOnPolicyUncertainty: boolean;
    auditLog: boolean;
  };
  console: { enabled: boolean; routePrefix: string };
};