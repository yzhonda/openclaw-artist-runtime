export const producerDigestModes = ["off", "daily", "important_events", "high_touch"] as const;
export const sunoConnectionModes = ["manual_copy", "background_browser_worker", "api_provider"] as const;
export const sunoAuthorityModes = ["prepare_only", "autofill_only", "auto_create_with_budget", "auto_create_and_select_take"] as const;
export const dailySharingModes = ["off", "draft_only", "auto"] as const;
export const officialReleaseModes = ["manual_approval", "auto_with_release_policy"] as const;
export const xAuthorityModes = ["draft_only", "auto_publish", "auto_publish_and_low_risk_replies"] as const;
export const instagramAuthorityModes = ["draft_only", "auto_publish_visuals"] as const;
export const tiktokAuthorityModes = ["draft_only", "auto_publish_clips"] as const;
export const socialAuthorityModes = [
  "disabled",
  "draft_only",
  "auto_publish",
  "auto_publish_and_low_risk_replies",
  "auto_publish_visuals",
  "auto_publish_clips",
  "auto_posts_and_low_risk_replies",
  "full_social_autonomy"
] as const;
export const socialRiskLevels = ["low", "medium", "high"] as const;
export const capabilityStates = [true, false, "unknown"] as const;
export const sunoWorkerStates = ["disconnected", "connecting", "connected", "login_required", "login_challenge", "captcha", "payment_prompt", "ui_mismatch", "quota_exhausted", "paused", "stopped"] as const;
export const autopilotStages = ["idle", "planning", "prompt_pack", "suno_generation", "take_selection", "asset_generation", "publishing", "completed", "paused", "failed_closed"] as const;
export const songStatuses = ["idea", "brief", "lyrics", "suno_prompt_pack", "suno_running", "takes_imported", "take_selected", "social_assets", "published", "archived", "failed"] as const;
export const sunoRunStatuses = ["blocked_dry_run", "blocked_authority", "accepted", "imported", "failed"] as const;
export const alertSeverities = ["info", "warning", "critical"] as const;
export const setupChecklistStates = ["complete", "pending", "attention"] as const;
export const sunoLoginHandoffStates = ["waiting_for_operator", "completed"] as const;

export type ProducerDigestMode = (typeof producerDigestModes)[number];
export type SunoConnectionMode = (typeof sunoConnectionModes)[number];
export type SunoAuthority = (typeof sunoAuthorityModes)[number];
export type DailySharingMode = (typeof dailySharingModes)[number];
export type OfficialReleaseMode = (typeof officialReleaseModes)[number];
export type XAuthority = (typeof xAuthorityModes)[number];
export type InstagramAuthority = (typeof instagramAuthorityModes)[number];
export type TikTokAuthority = (typeof tiktokAuthorityModes)[number];
export type SocialAuthorityMode = (typeof socialAuthorityModes)[number];
export type SocialRiskLevel = (typeof socialRiskLevels)[number];
export type SocialPlatform = "x" | "instagram" | "tiktok";
export type CapabilityState = (typeof capabilityStates)[number];
export type SunoWorkerState = (typeof sunoWorkerStates)[number];
export type AutopilotStage = (typeof autopilotStages)[number];
export type SongStatus = (typeof songStatuses)[number];
export type SunoRunStatus = (typeof sunoRunStatuses)[number];
export type AlertSeverity = (typeof alertSeverities)[number];
export type SetupChecklistState = (typeof setupChecklistStates)[number];
export type SunoLoginHandoffState = (typeof sunoLoginHandoffStates)[number];

export interface ArtistConfig {
  mode: "public_artist";
  artistId: string;
  profilePath: string;
  workspaceRoot: string;
}

export interface AutopilotConfig {
  enabled: boolean;
  dryRun: boolean;
  songsPerWeek: number;
  cycleIntervalMinutes: number;
  producerDigest: ProducerDigestMode;
}

export interface SunoMusicConfig {
  enabled: boolean;
  connectionMode: SunoConnectionMode;
  authority: SunoAuthority;
  monthlyGenerationBudget: number;
  maxGenerationsPerDay: number;
  minMinutesBetweenCreates: number;
  stopOnLoginChallenge: boolean;
  stopOnCaptcha: boolean;
  stopOnPaymentPrompt: boolean;
  promptLogging: "full";
}

export interface MusicConfig {
  engine: "suno";
  suno: SunoMusicConfig;
}

export interface XPlatformConfig {
  enabled: boolean;
  connector: "bird";
  authority: XAuthority;
  maxPostsPerDay: number;
  maxRepliesPerDay: number;
  autoPostTypes: string[];
}

export interface InstagramPlatformConfig {
  enabled: boolean;
  connector: "instagram_content_publishing";
  authority: InstagramAuthority;
  maxPostsPerDay: number;
  autoPostTypes: string[];
}

export interface TikTokPlatformConfig {
  enabled: boolean;
  connector: "tiktok_content_posting";
  authority: TikTokAuthority;
  maxPostsPerDay: number;
  autoPostTypes: string[];
}

export interface DistributionConfig {
  enabled: boolean;
  dailySharing: DailySharingMode;
  officialRelease: OfficialReleaseMode;
  platforms: {
    x: XPlatformConfig;
    instagram: InstagramPlatformConfig;
    tiktok: TikTokPlatformConfig;
  };
}

export interface SafetyConfig {
  auditLog: boolean;
  failClosed: boolean;
  forbiddenTopics: string[];
  forbidCaptchaBypass: boolean;
  forbidCredentialLogging: boolean;
  requireApprovalForHighRisk: boolean;
}

export interface ArtistRuntimeConfig {
  artist: ArtistConfig;
  autopilot: AutopilotConfig;
  music: MusicConfig;
  distribution: DistributionConfig;
  safety: SafetyConfig;
}

export interface ValidationResult<T = void> {
  ok: boolean;
  errors: string[];
  value?: T;
}

export interface AuthorityDecision {
  allowed: boolean;
  reason: string;
  requiresApproval?: boolean;
  hardStop?: boolean;
  policyDecision?: string;
}

export interface VerificationResult {
  status: "verified" | "pending" | "failed";
  detail?: string;
}

export interface SerializedError {
  name: string;
  message: string;
}

export interface PromptLedgerEntry {
  id: string;
  timestamp: string;
  stage: string;
  songId?: string;
  runId?: string;
  actor?: "artist" | "producer" | "system" | "connector";
  artistReason?: string;
  inputRefs?: string[];
  outputRefs?: string[];
  promptText?: string;
  promptHash?: string;
  outputSummary?: string;
  outputHash?: string;
  payloadHash?: string;
  configSnapshot?: unknown;
  artistSnapshotHash?: string;
  currentStateHash?: string;
  knowledgePackHash?: string;
  policyDecision?: AuthorityDecision;
  verification?: VerificationResult;
  error?: SerializedError;
}

export interface SongState {
  songId: string;
  title: string;
  status: SongStatus;
  createdAt: string;
  updatedAt: string;
  briefPath?: string;
  lyricsVersion?: number;
  selectedTakeId?: string;
  publicLinks: string[];
  runCount: number;
  lastReason?: string;
}

export interface SongIdeaResult {
  songId: string;
  title: string;
  briefPath: string;
  status: SongStatus;
  artistReason: string;
  ledgerEntryIds: string[];
}

export interface AuditEvent {
  timestamp: string;
  eventType: string;
  actor: "artist" | "producer" | "system" | "connector";
  sourceRefs?: string[];
  policyDecision?: AuthorityDecision;
  verification?: VerificationResult;
  error?: SerializedError;
  details?: Record<string, unknown>;
}

export interface JsonlHealth {
  healthy: boolean;
  lineCount: number;
  errors: string[];
}

export interface ConnectionStatus {
  connected: boolean;
  accountLabel?: string;
  reason?: string;
}

export interface SocialCapability {
  textPost: CapabilityState;
  imagePost: CapabilityState;
  videoPost: CapabilityState;
  carouselPost: CapabilityState;
  reelPost: CapabilityState;
  reply: CapabilityState;
  quote: CapabilityState;
  dm: CapabilityState;
  scheduledPost: CapabilityState;
  metrics: CapabilityState;
}

export interface SocialPublishRequest {
  dryRun: boolean;
  authority: SocialAuthorityMode;
  postType: string;
  text?: string;
  mediaPaths?: string[];
  targetId?: string;
  targetUrl?: string;
}

export interface SocialPublishResult {
  accepted: boolean;
  platform: SocialPlatform;
  dryRun: boolean;
  reason: string;
  id?: string;
  url?: string;
  raw?: unknown;
}

export interface SocialPublishLedgerEntry {
  timestamp: string;
  platform: SocialPlatform;
  connector: string;
  songId: string;
  postType: string;
  action: "publish" | "reply";
  accepted: boolean;
  dryRun: boolean;
  textHash?: string;
  mediaRefs: string[];
  policyDecision?: AuthorityDecision;
  url?: string;
  verification?: VerificationResult;
  error?: SerializedError;
  reason: string;
}

export interface SocialAssetRecord {
  songId: string;
  platform: SocialPlatform;
  postType: string;
  textPath: string;
  mediaRefs: string[];
  sourceTakeId?: string;
}

export interface PlatformStatus {
  connected: boolean;
  authority: string;
  capabilitySummary: SocialCapability;
  accountLabel?: string;
  postsToday?: number;
  repliesToday?: number;
  lastAction?: SocialPublishLedgerEntry;
  reason?: string;
}

export interface MusicSummary {
  monthlyGenerationBudget: number;
  monthlyRuns: number;
  dailyRuns: number;
  latestPromptPackVersion?: number;
  latestPromptPackMetadata?: Record<string, unknown>;
}

export interface DistributionSummary {
  postsToday: number;
  repliesToday: number;
  lastPlatform?: SocialPlatform;
  lastPostUrl?: string;
}

export interface SetupChecklistItem {
  id: string;
  label: string;
  state: SetupChecklistState;
  detail: string;
}

export interface SetupReadiness {
  completeCount: number;
  totalCount: number;
  readyForAutopilot: boolean;
  nextRecommendedAction: string;
  checklist: SetupChecklistItem[];
}

export interface SocialDistributionWorkerStatus {
  enabled: boolean;
  dryRun: boolean;
  lastSongId?: string;
  lastAction?: SocialPublishLedgerEntry;
  enabledPlatforms: SocialPlatform[];
  blockedReason?: string;
  postsToday: number;
  repliesToday: number;
}

export interface SunoLoginHandoff {
  state: SunoLoginHandoffState;
  reason: "operator_login_required" | "reconnect_requested" | "login_challenge" | "captcha" | "payment_prompt";
  message: string;
  requestedAt: string;
  completedAt?: string;
}

export interface SunoWorkerStatus {
  state: SunoWorkerState;
  connected: boolean;
  hardStopReason?: string;
  lastTransitionAt?: string;
  failureCount?: number;
  pendingAction?: string;
  loginHandoff?: SunoLoginHandoff;
}

export interface SunoCreateRequest {
  dryRun: boolean;
  authority: SunoAuthority;
  payload: Record<string, unknown>;
}

export interface SunoCreateResult {
  accepted: boolean;
  runId: string;
  reason: string;
  urls: string[];
}

export interface SunoImportResult {
  urls: string[];
  runId?: string;
}

export interface SunoRunRecord {
  runId: string;
  songId: string;
  createdAt: string;
  mode: SunoConnectionMode;
  authorityDecision: AuthorityDecision;
  payloadHash?: string;
  status: SunoRunStatus;
  dryRun: boolean;
  urls: string[];
  error?: SerializedError;
}

export interface TakeSelectionRecord {
  songId: string;
  runId: string;
  selectedTakeId: string;
  reason: string;
  sourceUrls: string[];
  verification: VerificationResult;
  createdAt?: string;
}

export interface SunoSliders {
  weirdness: number;
  styleInfluence: number;
  audioInfluence: number;
}

export interface SunoPromptPackValidation {
  valid: boolean;
  errors: string[];
}

export interface SunoPromptPack {
  songId: string;
  songTitle: string;
  artistReason: string;
  style: string;
  exclude: string;
  yamlLyrics: string;
  sliders: SunoSliders;
  payload: Record<string, unknown>;
  validation: SunoPromptPackValidation;
  promptHash: string;
  payloadHash: string;
  artistSnapshotHash: string;
  currentStateHash: string;
  knowledgePackHash: string;
}

export interface CreateSunoPromptPackInput {
  songId: string;
  songTitle: string;
  artistReason: string;
  lyricsText: string;
  artistSnapshot: string;
  currentStateSnapshot: string;
  knowledgePackVersion?: string;
}

export interface PersistSunoPromptPackInput extends Omit<CreateSunoPromptPackInput, "artistSnapshot" | "currentStateSnapshot"> {
  workspaceRoot: string;
  artistSnapshot?: string;
  currentStateSnapshot?: string;
  configSnapshot?: unknown;
}

export interface PersistedPromptPackResult {
  songId: string;
  packVersion: number;
  pack: SunoPromptPack;
  artifactPaths: {
    lyricsVersioned: string;
    yamlLatest: string;
    styleLatest: string;
    excludeLatest: string;
    slidersLatest: string;
    payloadLatest: string;
    validationLatest: string;
    snapshotDir: string;
    promptLedger: string;
  };
  ledgerEntryIds: string[];
}

export interface MusicAuthorityInput {
  dryRun: boolean;
  authority: SunoAuthority;
  budgetRemaining: number;
  connectionMode?: SunoConnectionMode;
  workerState?: SunoWorkerState;
  requestedAction: "prepare" | "create" | "select_take";
}

export interface SocialAuthorityInput {
  dryRun: boolean;
  authority: SocialAuthorityMode;
  platform: SocialPlatform;
  risk: SocialRiskLevel;
  postType: string;
  requestedAction?: "publish" | "reply";
  capabilityAvailable?: CapabilityState;
}

export interface AutopilotStatus {
  enabled: boolean;
  dryRun: boolean;
  stage: AutopilotStage;
  nextAction: string;
  currentRunId?: string;
  currentSongId?: string;
  lastSuccessfulStage?: AutopilotStage;
  pausedReason?: string;
  hardStopReason?: string;
  blockedReason?: string;
  lastError?: string;
  retryCount?: number;
}

export interface AutopilotRunState {
  runId?: string;
  currentSongId?: string;
  stage: AutopilotStage;
  paused: boolean;
  pausedReason?: string;
  hardStopReason?: string;
  blockedReason?: string;
  lastError?: string;
  lastSuccessfulStage?: AutopilotStage;
  retryCount: number;
  cycleCount: number;
  updatedAt: string;
  lastRunAt?: string;
}

export interface AutopilotTickerStatus {
  lastOutcome?: string;
  lastTickAt?: string;
  intervalMs: number;
}

export interface AlertRecord {
  id: string;
  severity: AlertSeverity;
  source: "autopilot" | "suno_worker" | "platform" | "prompt_ledger" | "social_ledger" | "audit_log";
  scope: "global" | "song";
  message: string;
  songId?: string;
  detail?: string;
  createdAt: string;
  ackedAt?: string;
}

export interface StatusResponse {
  config: ArtistRuntimeConfig;
  dryRun: boolean;
  autopilot: AutopilotStatus;
  ticker: AutopilotTickerStatus;
  sunoWorker: SunoWorkerStatus;
  distributionWorker: SocialDistributionWorkerStatus;
  platforms: Record<SocialPlatform, PlatformStatus>;
  musicSummary: MusicSummary;
  distributionSummary: DistributionSummary;
  setupReadiness: SetupReadiness;
  alerts: AlertRecord[];
  recentSong?: SongState;
  lastSunoRun?: SunoRunRecord;
  lastSocialAction?: SocialPublishLedgerEntry;
}
