import { startTransition, useEffect, useState } from "react";
import "./styles.css";
import { buildConfigDraft, buildConfigUpdatePatch, validateConfigDraft, type ConfigDraft } from "./configEditor";
import { SunoOutcomeCard, type ImportedAsset } from "./SunoOutcomeCard";
import { instagramAuthorityModes, tiktokAuthorityModes, xAuthorityModes } from "../../src/types";

type StatusResponse = {
  dryRun: boolean;
  setupReadiness: {
    completeCount: number;
    totalCount: number;
    readyForAutopilot: boolean;
    nextRecommendedAction: string;
    checklist: Array<{
      id: string;
      label: string;
      state: "complete" | "pending" | "attention";
      detail: string;
    }>;
  };
  autopilot: {
    stage: string;
    nextAction: string;
    currentRunId?: string;
    currentSongId?: string;
    blockedReason?: string;
    lastError?: string;
  };
  ticker: {
    lastOutcome?: string;
    lastTickAt?: string;
    intervalMs: number;
  };
  suno: {
    budget: {
      date: string;
      consumed: number;
      limit: number;
      remaining: number;
    };
  };
  sunoWorker: {
    state: string;
    hardStopReason?: string;
    pendingAction?: string;
    currentRunId?: string;
    lastImportedRunId?: string;
    lastCreateOutcome?: {
      runId: string;
      accepted: boolean;
      reason: string;
      at: string;
      dryRun?: boolean;
    };
    lastImportOutcome?: {
      runId: string;
      urlCount: number;
      pathCount?: number;
      paths?: string[];
      metadata?: ImportedAsset[];
      reason?: string;
      at: string;
      dryRun?: boolean;
    };
  };
  distributionWorker: {
    enabled: boolean;
    dryRun: boolean;
    liveGoArmed: boolean;
    platformLiveGoArmed: Record<string, boolean>;
    effectiveDryRun: Record<string, boolean>;
    lastSongId?: string;
    enabledPlatforms: string[];
    blockedReason?: string;
    postsToday: number;
    repliesToday: number;
  };
  musicSummary: {
    monthlyRuns: number;
    monthlyGenerationBudget: number;
    dailyRuns: number;
    latestPromptPackVersion?: number;
  };
  distributionSummary: {
    postsToday: number;
    repliesToday: number;
    lastPlatform?: string;
  };
  platforms: Record<string, {
    connected: boolean;
    authority: string;
    accountLabel?: string;
    reason?: string;
    capabilitySummary?: Record<string, boolean | "unknown">;
    liveGoArmed?: boolean;
    effectiveDryRun?: boolean;
    postsToday?: number;
    repliesToday?: number;
  }>;
  alerts: Array<{
    id: string;
    severity: "info" | "warning" | "critical";
    message: string;
    source: string;
    ackedAt?: string;
  }>;
  recentSong?: {
    songId: string;
    title: string;
    status: string;
    runCount: number;
  };
  lastSunoRun?: {
    runId: string;
    songId: string;
    status: string;
    urls: string[];
  };
  lastSocialAction?: {
    platform: string;
    action: string;
    accepted: boolean;
    url?: string;
    reason?: string;
  };
};

type ConfigResponse = {
  artist: {
    artistId: string;
    workspaceRoot: string;
  };
  music: {
    suno: {
      dailyCreditLimit: number;
    };
  };
  autopilot: {
    enabled: boolean;
    dryRun: boolean;
    songsPerWeek: number;
    cycleIntervalMinutes: number;
  };
  distribution: {
    liveGoArmed: boolean;
    platforms: {
      x: { enabled: boolean; liveGoArmed: boolean; authority: string };
      instagram: { enabled: boolean; liveGoArmed: boolean; authority: string };
      tiktok: { enabled: boolean; liveGoArmed: boolean; authority: string };
    };
  };
};

type SongSummary = {
  songId: string;
  title: string;
  status: string;
  runCount: number;
  selectedTakeId?: string;
};

type SongDetail = {
  song: SongSummary;
  brief: string;
  promptLedger: unknown[];
  sunoRuns: Array<{ runId: string; status: string; urls: string[] }>;
  takeSelections: unknown[];
  takeHistory?: Array<{ selectedTakeId: string; reason: string; createdAt?: string }>;
  latestPromptPack?: { version: number; metadata?: Record<string, unknown> };
  selectedTake?: { selectedTakeId?: string };
  socialAssets?: Array<{ platform: string; postType: string; sourceTakeId?: string }>;
  lastSocialAction?: { platform: string; action: string; accepted: boolean; url?: string; reason?: string };
};

type PlatformDetail = {
  connected: boolean;
  authority: string;
  postsToday?: number;
  repliesToday?: number;
  accountLabel?: string;
  reason?: string;
  capabilitySummary?: Record<string, boolean | "unknown">;
  liveGoArmed?: boolean;
  effectiveDryRun?: boolean;
};

type SunoStatusResponse = {
  worker: {
    state: string;
    hardStopReason?: string;
    pendingAction?: string;
    currentRunId?: string;
    lastImportedRunId?: string;
    lastCreateOutcome?: {
      runId: string;
      accepted: boolean;
      reason: string;
      at: string;
      dryRun?: boolean;
    };
    lastImportOutcome?: {
      runId: string;
      urlCount: number;
      reason?: string;
      at: string;
      dryRun?: boolean;
    };
  };
  currentSongId?: string;
  latestRun?: { runId: string; status: string };
  recentRuns: Array<{ runId: string; status: string; urls: string[] }>;
  latestPromptPackVersion?: number;
  currentRunId?: string;
  lastImportedRunId?: string;
  lastCreateOutcome?: {
    runId: string;
    accepted: boolean;
    reason: string;
    at: string;
    dryRun?: boolean;
  };
  lastImportOutcome?: {
    runId: string;
    urlCount: number;
    pathCount?: number;
    paths?: string[];
    metadata?: ImportedAsset[];
    reason?: string;
    at: string;
    dryRun?: boolean;
  };
};

type ArtistMindResponse = {
  artist: string;
  currentState: string;
  socialVoice: string;
  songbook: string;
};

type AuditEntry = {
  timestamp: string;
  eventType?: string;
  actor?: string;
  songId?: string;
  details?: Record<string, unknown>;
};

type PromptLedgerEntry = {
  id?: string;
  timestamp?: string;
  stage?: string;
  runId?: string;
  songId?: string;
  outputSummary?: string;
  artistReason?: string;
};

type RecoveryResponse = {
  autopilot: {
    stage: string;
    blockedReason?: string;
    lastError?: string;
  };
  sunoWorker: {
    state: string;
    hardStopReason?: string;
    pendingAction?: string;
  };
  distributionWorker: {
    enabled: boolean;
    blockedReason?: string;
  };
  alerts: Array<{
    id: string;
    severity: "info" | "warning" | "critical";
    message: string;
  }>;
  recentAudit: AuditEntry[];
  diagnostics: {
    workspaceRoot: string;
    dryRun: boolean;
    recentSongId?: string;
    currentRunId?: string;
    currentSongId?: string;
    blockedReason?: string;
  };
};

type ConsoleView = "dashboard" | "setup" | "music" | "platforms" | "songs" | "prompt-ledger" | "alerts" | "artist-mind" | "settings" | "recovery";

const consoleViews: Array<{ id: ConsoleView; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "setup", label: "Setup" },
  { id: "music", label: "Music / Suno" },
  { id: "platforms", label: "Platforms" },
  { id: "songs", label: "Songs" },
  { id: "prompt-ledger", label: "Prompt Ledger" },
  { id: "alerts", label: "Alerts" },
  { id: "artist-mind", label: "Artist Mind" },
  { id: "settings", label: "Settings" },
  { id: "recovery", label: "Recovery" }
];

const apiBase = "/plugins/artist-runtime/api";

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase}${path}`);
  if (!response.ok) {
    throw new Error(`${path} -> ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function apiPost<T>(path: string, body: unknown = {}): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`${path} -> ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function MetricCard(props: { label: string; value: string; detail: string }) {
  return (
    <article className="panel metric-card">
      <div className="eyebrow">{props.label}</div>
      <div className="metric-value">{props.value}</div>
      <div className="muted">{props.detail}</div>
    </article>
  );
}

function excerpt(value: string, maxLength = 220): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "No brief yet.";
  }
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}...` : trimmed;
}

function platformEnabled(draft: ConfigDraft | null, platform: "x" | "instagram" | "tiktok"): boolean {
  if (!draft) {
    return false;
  }
  switch (platform) {
    case "instagram":
      return draft.instagramEnabled;
    case "tiktok":
      return draft.tiktokEnabled;
    case "x":
    default:
      return draft.xEnabled;
  }
}

function platformLiveGoArmed(draft: ConfigDraft | null, platform: "x" | "instagram" | "tiktok"): boolean {
  if (!draft) {
    return false;
  }
  switch (platform) {
    case "instagram":
      return draft.instagramLiveGoArmed;
    case "tiktok":
      return draft.tiktokLiveGoArmed;
    case "x":
    default:
      return draft.xLiveGoArmed;
  }
}

function currentImportedAssets(status: StatusResponse | null, sunoStatus: SunoStatusResponse | null): ImportedAsset[] {
  return sunoStatus?.lastImportOutcome?.metadata
    ?? sunoStatus?.worker.lastImportOutcome?.metadata
    ?? status?.sunoWorker.lastImportOutcome?.metadata
    ?? [];
}

function formatProbeReason(reason?: string): string {
  if (!reason) {
    return "ready";
  }
  return reason.replace(/_/g, " ");
}

function platformProbeBadge(
  platform: "x" | "instagram" | "tiktok",
  detail: PlatformDetail
): { label: string; className: string } {
  if (platform === "tiktok") {
    return {
      label: "account not created",
      className: "badge-frozen"
    };
  }

  if (detail.connected) {
    return {
      label: "connected",
      className: "badge-ok"
    };
  }

  if (detail.reason === "instagram_auth_not_configured") {
    return {
      label: "auth missing",
      className: "badge-warning"
    };
  }

  if (detail.reason === "bird_cli_not_installed") {
    return {
      label: "bird missing",
      className: "badge-warning"
    };
  }

  if (detail.reason === "bird_auth_expired") {
    return {
      label: "auth expired",
      className: "badge-warning"
    };
  }

  if (detail.reason) {
    return {
      label: formatProbeReason(detail.reason),
      className: "badge-warning"
    };
  }

  return {
    label: "offline",
    className: "badge-warning"
  };
}

export function App() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [songs, setSongs] = useState<SongSummary[]>([]);
  const [detail, setDetail] = useState<SongDetail | null>(null);
  const [sunoStatus, setSunoStatus] = useState<SunoStatusResponse | null>(null);
  const [artistMind, setArtistMind] = useState<ArtistMindResponse | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [promptLedgerEntries, setPromptLedgerEntries] = useState<PromptLedgerEntry[]>([]);
  const [recovery, setRecovery] = useState<RecoveryResponse | null>(null);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ConsoleView>("dashboard");
  const [configDraft, setConfigDraft] = useState<ConfigDraft | null>(null);
  const [configDirty, setConfigDirty] = useState(false);
  const [platformTests, setPlatformTests] = useState<Record<string, { testedAt: string; status: PlatformDetail }>>({});
  const [replyTargetId, setReplyTargetId] = useState("");
  const [replyText, setReplyText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async (preferredSongId?: string | null, forceConfigDraftSync = false) => {
    try {
      setError(null);
      const [nextStatus, nextSongs, nextConfig, nextSunoStatus, nextArtistMind, nextAuditEntries, nextRecovery] = await Promise.all([
        apiGet<StatusResponse>("/status"),
        apiGet<SongSummary[]>("/songs"),
        apiGet<ConfigResponse>("/config"),
        apiGet<SunoStatusResponse>("/suno/status"),
        apiGet<ArtistMindResponse>("/artist-mind"),
        apiGet<AuditEntry[]>("/audit"),
        apiGet<RecoveryResponse>("/recovery")
      ]);
      const nextSelectedSongId = preferredSongId
        ?? selectedSongId
        ?? nextStatus.recentSong?.songId
        ?? nextSongs[0]?.songId
        ?? null;
      const [nextDetail, nextPromptLedgerEntries] = await Promise.all([
        nextSelectedSongId
          ? apiGet<SongDetail>(`/songs/${nextSelectedSongId}`)
          : Promise.resolve(null),
        nextSelectedSongId
          ? apiGet<PromptLedgerEntry[]>(`/songs/${nextSelectedSongId}/ledger`)
          : apiGet<PromptLedgerEntry[]>("/prompt-ledger")
      ]);
      startTransition(() => {
        setStatus(nextStatus);
        setConfig(nextConfig);
        setSunoStatus(nextSunoStatus);
        setArtistMind(nextArtistMind);
        setAuditEntries(nextAuditEntries);
        setPromptLedgerEntries(nextPromptLedgerEntries);
        setRecovery(nextRecovery);
        setSongs(nextSongs);
        setDetail(nextDetail);
        setSelectedSongId(nextSelectedSongId);
        if (forceConfigDraftSync || !configDirty) {
          setConfigDraft(buildConfigDraft(nextConfig));
        }
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
    }
  };

  useEffect(() => {
    void refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (busy) {
        return;
      }
      void refresh(selectedSongId);
    }, 3000);
    return () => clearInterval(intervalId);
  }, [busy, configDirty, selectedSongId]); // eslint-disable-line react-hooks/exhaustive-deps

  const runAction = async (action: "pause" | "resume" | "run-cycle" | "ideate") => {
    setBusy(action);
    try {
      if (action === "pause") {
        await apiPost("/pause");
      } else if (action === "resume") {
        await apiPost("/resume");
      } else if (action === "ideate") {
        const created = await apiPost<{ songId: string }>("/songs/ideate");
        await refresh(created.songId);
        return;
      } else {
        await apiPost("/run-cycle");
      }
      await refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
    } finally {
      setBusy(null);
    }
  };

  const acknowledge = async (alertId: string) => {
    setBusy(`ack:${alertId}`);
    try {
      await apiPost(`/alerts/${alertId}/ack`);
      await refresh(selectedSongId);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
    } finally {
      setBusy(null);
    }
  };

  const saveConfig = async () => {
    if (!configDraft) {
      return;
    }
    const validationError = validateConfigDraft(configDraft);
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy("config");
    try {
      const patch = buildConfigUpdatePatch(configDraft);
      await apiPost("/config/update", {
        patch
      });
      setConfigDirty(false);
      await refresh(selectedSongId, true);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
    } finally {
      setBusy(null);
    }
  };

  const updateConfigDraft = (update: Partial<ConfigDraft>) => {
    setConfigDirty(true);
    setConfigDraft((current) => (current ? { ...current, ...update } : current));
  };

  const resetConfigDraft = () => {
    if (!config) {
      return;
    }
    setConfigDirty(false);
    setConfigDraft(buildConfigDraft(config));
    setError(null);
  };

  const configValidationError = configDraft ? validateConfigDraft(configDraft) : null;
  const globalArmHeld = Boolean(configDraft && !configDraft.distributionLiveGoArmed);

  const testPlatform = async (platform: "x" | "instagram" | "tiktok") => {
    if (platform === "tiktok") {
      return;
    }
    setBusy(`platform:${platform}`);
    try {
      const result = await apiPost<{ testedAt: string; status: PlatformDetail }>(`/platforms/${platform}/test`);
      startTransition(() => {
        setPlatformTests((current) => ({ ...current, [platform]: result }));
      });
      await refresh(selectedSongId);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
    } finally {
      setBusy(null);
    }
  };

  const togglePlatform = async (platform: "x" | "instagram" | "tiktok", enabled: boolean) => {
    setBusy(`platform-toggle:${platform}`);
    try {
      await apiPost(`/platforms/${platform}/${enabled ? "connect" : "disconnect"}`);
      await refresh(selectedSongId);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
    } finally {
      setBusy(null);
    }
  };

  const runSunoAction = async (action: "connect" | "reconnect" | "generate") => {
    setBusy(`suno:${action}`);
    try {
      if (action === "generate") {
        if (!selectedSongId) {
          throw new Error("no song selected for Suno generate");
        }
        await apiPost(`/suno/generate/${selectedSongId}`);
      } else {
        await apiPost(`/suno/${action}`);
      }
      await refresh(selectedSongId);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
    } finally {
      setBusy(null);
    }
  };

  const simulateReply = async () => {
    if (!selectedSongId) {
      setError("select a song before simulating a reply");
      return;
    }
    setBusy("simulate-reply");
    try {
      await apiPost("/platforms/x/simulate-reply", {
        songId: selectedSongId,
        targetId: replyTargetId,
        text: replyText
      });
      setReplyText("");
      await refresh(selectedSongId);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
    } finally {
      setBusy(null);
    }
  };

  const setupPanel = (
    <article className="panel">
      <div className="section-title">Setup Readiness</div>
      <div className="list">
        <div className="item">
          <strong>{status?.setupReadiness.readyForAutopilot ? "ready for live autopilot" : "setup in progress"}</strong>
          <div className="muted">{status ? `next: ${status.setupReadiness.nextRecommendedAction}` : "loading"}</div>
        </div>
        {status?.setupReadiness.checklist.map((item) => (
          <div className={`item setup-${item.state}`} key={item.id}>
            <div className="inline-actions">
              <strong>{item.label}</strong>
              <span className={`pill pill-${item.state}`}>{item.state}</span>
            </div>
            <div className="muted">{item.detail}</div>
          </div>
        )) ?? <div className="item muted">Loading setup state.</div>}
      </div>
    </article>
  );

  const distributionWorkerPanel = (
    <article className="panel">
      <div className="section-title">Distribution Worker</div>
      <div className="list">
        <div className="item">
          <strong>{status?.distributionWorker.enabled ? "enabled" : "disabled"}</strong>
          <div className="muted">{status?.distributionWorker.blockedReason ?? "distribution ready"}</div>
        </div>
        <div className="item">
          <div className="eyebrow">Enabled Platforms</div>
          <div className="muted">{status?.distributionWorker.enabledPlatforms.join(" · ") || "none"}</div>
        </div>
        <div className="item">
          <div className="eyebrow">Daily Counters</div>
          <div className="muted">posts {status?.distributionWorker.postsToday ?? 0} · replies {status?.distributionWorker.repliesToday ?? 0}</div>
        </div>
        <div className="item">
          <div className="eyebrow">Live-Go Arms</div>
          <div className="muted">global {status?.distributionWorker.liveGoArmed ? "armed" : "off"}</div>
          <div className="muted">
            x {status?.distributionWorker.platformLiveGoArmed?.x ? "armed" : "off"} ·
            ig {status?.distributionWorker.platformLiveGoArmed?.instagram ? "armed" : "off"} ·
            tt {status?.distributionWorker.platformLiveGoArmed?.tiktok ? "armed" : "off"}
          </div>
        </div>
      </div>
    </article>
  );

  const recentXResultPanel = (
    <article className="panel">
      <div className="section-title">Recent X Result</div>
      <div className="list">
        <div className="item">
          <strong>{status?.lastSocialAction?.platform === "x" ? `${status.lastSocialAction.action}` : "none"}</strong>
          <div className="muted">
            {status?.lastSocialAction?.platform === "x"
              ? `${status.lastSocialAction.accepted ? "accepted" : "blocked"} · ${status.lastSocialAction.reason ?? "no reason"}`
              : "No X publish or reply result yet."}
          </div>
          <div className="muted">{status?.lastSocialAction?.platform === "x" ? (status.lastSocialAction.url ?? "no url") : ""}</div>
        </div>
      </div>
    </article>
  );

  const replySimulationPanel = (
    <article className="panel">
      <div className="section-title">Simulate Reply</div>
      <div className="config-form">
        <label>
          <div className="eyebrow">Target Tweet ID or URL</div>
          <input value={replyTargetId} onChange={(event) => setReplyTargetId(event.target.value)} placeholder="1900000000000000000 or https://x.com/..." />
        </label>
        <label>
          <div className="eyebrow">Reply Text</div>
          <textarea value={replyText} onChange={(event) => setReplyText(event.target.value)} rows={4} placeholder="dry-run reply text" />
        </label>
        <div className="muted">This route is forced to dry-run. No live reply is sent.</div>
        <div className="inline-actions">
          <button
            className="primary"
            disabled={busy !== null || !selectedSongId || !replyTargetId.trim() || !replyText.trim()}
            onClick={() => void simulateReply()}
          >
            Simulate Reply
          </button>
        </div>
      </div>
    </article>
  );

  const sunoPanel = (
    <article className="panel">
      <div className="section-title">Suno</div>
      <SunoOutcomeCard
        state={sunoStatus?.worker.state ?? "-"}
        pendingAction={sunoStatus?.worker.pendingAction}
        hardStopReason={sunoStatus?.worker.hardStopReason}
        currentSongId={sunoStatus?.currentSongId}
        currentRunId={sunoStatus?.currentRunId ?? sunoStatus?.worker.currentRunId}
        lastImportedRunId={sunoStatus?.lastImportedRunId ?? sunoStatus?.worker.lastImportedRunId}
        lastCreateOutcome={sunoStatus?.lastCreateOutcome ?? sunoStatus?.worker.lastCreateOutcome}
        lastImportOutcome={sunoStatus?.lastImportOutcome ?? sunoStatus?.worker.lastImportOutcome}
        budget={status?.suno.budget}
      />
      <div className="list">
        <div className="inline-actions">
          <button disabled={busy !== null} onClick={() => void runSunoAction("connect")}>Connect</button>
          <button disabled={busy !== null} onClick={() => void runSunoAction("reconnect")}>Reconnect</button>
          <button className="primary" disabled={busy !== null || !selectedSongId} onClick={() => void runSunoAction("generate")}>Generate Current Song</button>
        </div>
        <div className="item">
          <div className="eyebrow">Recent Runs</div>
          <div className="muted">
            {sunoStatus?.recentRuns.length
              ? sunoStatus.recentRuns.slice(0, 5).map((run) => `${run.runId}:${run.status}`).join(" · ")
              : "No Suno runs yet."}
          </div>
        </div>
      </div>
    </article>
  );

  const configPanel = (
    <article className="panel">
      <div className="section-title">Config Editor</div>
      {config && configDraft ? (
        <div className="config-form">
          <label className="toggle"><input type="checkbox" checked={configDraft.autopilotEnabled} onChange={(event) => updateConfigDraft({ autopilotEnabled: event.target.checked })} />Autopilot enabled</label>
          <label className="toggle"><input type="checkbox" checked={configDraft.dryRun} onChange={(event) => updateConfigDraft({ dryRun: event.target.checked })} />Dry-run safety</label>
          <label className="toggle"><input type="checkbox" checked={configDraft.distributionLiveGoArmed} onChange={(event) => updateConfigDraft({ distributionLiveGoArmed: event.target.checked })} />Live-Go Arm (global)</label>
          {globalArmHeld ? <div className="warning-banner">Global live-go arm is OFF. Every platform arm stays held upstream even if its own toggle is on.</div> : null}
          {!configDraft.dryRun ? <div className="warning-banner">Dry-run is OFF. The runtime stays fail-closed, but this arm can permit live side effects if the connectors are ready.</div> : null}
          <div className="field-grid">
            <label>
              <div className="eyebrow">Daily credit limit (Suno)</div>
              <input type="number" min={1} max={1000} step={1} value={configDraft.dailyCreditLimit} onChange={(event) => updateConfigDraft({ dailyCreditLimit: event.target.value })} />
            </label>
            <label>
              <div className="eyebrow">Songs Per Week</div>
              <input type="number" min={0} max={21} value={configDraft.songsPerWeek} onChange={(event) => updateConfigDraft({ songsPerWeek: event.target.value })} />
            </label>
            <label>
              <div className="eyebrow">Cycle Interval Minutes</div>
              <input type="number" min={15} max={1440} value={configDraft.cycleIntervalMinutes} onChange={(event) => updateConfigDraft({ cycleIntervalMinutes: event.target.value })} />
            </label>
          </div>
          <div className="field-grid">
            <label className={`platform-config${globalArmHeld ? " is-held" : ""}`}>
              <div className="toggle"><input type="checkbox" checked={configDraft.xEnabled} onChange={(event) => updateConfigDraft({ xEnabled: event.target.checked })} />X enabled</div>
              <div className="toggle toggle-arm-row">
                <input type="checkbox" checked={configDraft.xLiveGoArmed} onChange={(event) => updateConfigDraft({ xLiveGoArmed: event.target.checked })} />
                X live-go arm
                {globalArmHeld ? <span className="badge badge-held">held by global</span> : null}
                {status?.platforms.x?.effectiveDryRun ? <span className="badge badge-dry-run">effective dry-run</span> : null}
              </div>
              <div className="eyebrow">X Authority</div>
              <select value={configDraft.xAuthority} onChange={(event) => updateConfigDraft({ xAuthority: event.target.value as ConfigDraft["xAuthority"] })}>
                {xAuthorityModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
              </select>
            </label>
            <label className={`platform-config${globalArmHeld ? " is-held" : ""}`}>
              <div className="toggle"><input type="checkbox" checked={configDraft.instagramEnabled} onChange={(event) => updateConfigDraft({ instagramEnabled: event.target.checked })} />Instagram enabled</div>
              <div className="toggle toggle-arm-row">
                <input type="checkbox" checked={configDraft.instagramLiveGoArmed} onChange={(event) => updateConfigDraft({ instagramLiveGoArmed: event.target.checked })} />
                Instagram live-go arm
                {globalArmHeld ? <span className="badge badge-held">held by global</span> : null}
                {status?.platforms.instagram?.effectiveDryRun ? <span className="badge badge-dry-run">effective dry-run</span> : null}
              </div>
              <div className="eyebrow">Instagram Authority</div>
              <select value={configDraft.instagramAuthority} onChange={(event) => updateConfigDraft({ instagramAuthority: event.target.value as ConfigDraft["instagramAuthority"] })}>
                {instagramAuthorityModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
              </select>
            </label>
            <label className="platform-config is-frozen" title="アカウント未作成 / 凍結中">
              <div className="toggle"><input type="checkbox" checked={configDraft.tiktokEnabled} onChange={(event) => updateConfigDraft({ tiktokEnabled: event.target.checked })} />TikTok enabled</div>
              <div className="toggle toggle-arm-row" title="アカウント未作成 / 凍結中">
                <input type="checkbox" checked={configDraft.tiktokLiveGoArmed} disabled readOnly />
                TikTok live-go arm
                <span className="badge badge-frozen">frozen</span>
                {globalArmHeld ? <span className="badge badge-held">held by global</span> : null}
                {status?.platforms.tiktok?.effectiveDryRun ? <span className="badge badge-dry-run">effective dry-run</span> : null}
              </div>
              <div className="eyebrow">TikTok Authority</div>
              <select value={configDraft.tiktokAuthority} onChange={(event) => updateConfigDraft({ tiktokAuthority: event.target.value as ConfigDraft["tiktokAuthority"] })}>
                {tiktokAuthorityModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
              </select>
              <div className="muted platform-note">TikTok stays frozen until the operator account exists. The arm toggle is visible for status only.</div>
            </label>
          </div>
          <div className="muted">artist {config.artist.artistId} · workspace {config.artist.workspaceRoot}</div>
          {configValidationError ? <div className="field-error">{configValidationError}</div> : null}
          <div className="inline-actions">
            <button className="primary" disabled={busy !== null || Boolean(configValidationError)} onClick={() => void saveConfig()}>Save Settings</button>
            <button disabled={busy !== null || !configDirty} onClick={resetConfigDraft}>Reset Draft</button>
            <button disabled={busy !== null} onClick={() => void refresh(selectedSongId, true)}>Refresh</button>
          </div>
        </div>
      ) : <div className="item muted">Loading config.</div>}
    </article>
  );

  const songsPanel = (
    <article className="panel">
      <div className="section-title">Songs</div>
      <div className="list">
        {songs.length > 0 ? songs.map((song) => (
          <button className={`item item-button${selectedSongId === song.songId ? " is-selected" : ""}`} key={song.songId} disabled={busy !== null} onClick={() => void refresh(song.songId)}>
            <span className="pill">{song.status}</span>
            <strong>{song.title}</strong>
            <div className="muted">{song.songId} · runs {song.runCount}{song.selectedTakeId ? ` · take ${song.selectedTakeId}` : ""}</div>
          </button>
        )) : <div className="item muted">No songs yet.</div>}
      </div>
    </article>
  );

  const platformsPanel = (
    <article className="panel">
      <div className="section-title">Platforms</div>
      <div className="list">
        {status ? Object.entries(status.platforms).map(([platform, value]) => {
          const platformKey = platform as "x" | "instagram" | "tiktok";
          const isTikTok = platformKey === "tiktok";
          const probeResult = platformTests[platform]?.status ?? value;
          const probeBadge = platformProbeBadge(platformKey, probeResult);
          const testedAt = platformTests[platform]?.testedAt;
          return (
            <div className={`item${isTikTok ? " platform-frozen-card" : ""}`} key={platform}>
              <div className="inline-actions">
                <strong>{platform}</strong>
                <div className="inline-actions">
                  <span className={`badge ${probeBadge.className}`}>{probeBadge.label}</span>
                  {isTikTok ? (
                    <button disabled title="アカウント未作成 / 凍結中">凍結中 / アカウント未作成</button>
                  ) : (
                    <button disabled={busy !== null} onClick={() => void testPlatform(platformKey)}>Probe 再走</button>
                  )}
                  <button disabled={busy !== null} onClick={() => void togglePlatform(platformKey, !platformEnabled(configDraft, platformKey))}>
                    {platformEnabled(configDraft, platformKey) ? "Disable" : "Enable"}
                  </button>
                </div>
              </div>
              <div className="muted">{value.connected ? "connected" : "offline"} · {value.authority}</div>
              <div className="muted">arm {platformLiveGoArmed(configDraft, platformKey) ? "armed" : "off"} · {value.effectiveDryRun ? "effective dry-run" : "live lane open"}</div>
              <div className="muted">posts {value.postsToday ?? 0} · replies {value.repliesToday ?? 0}</div>
              <div className="muted">
                {testedAt ? `tested ${testedAt} · ${formatProbeReason(probeResult.reason)}` : `probe ${formatProbeReason(probeResult.reason)}`}
              </div>
            </div>
          );
        }) : <div className="item muted">Loading platforms.</div>}
      </div>
    </article>
  );

  const alertsPanel = (
    <article className="panel">
      <div className="section-title">Alerts</div>
      <div className="list">
        {status?.alerts.length ? status.alerts.map((alert) => (
          <div className={`item alert-${alert.severity}`} key={alert.id}>
            <strong>{alert.message}</strong>
            <div className="muted">{alert.source}{alert.ackedAt ? " · acknowledged" : ""}</div>
            {!alert.ackedAt ? <div className="inline-actions"><button disabled={busy !== null} onClick={() => void acknowledge(alert.id)}>Acknowledge</button></div> : null}
          </div>
        )) : <div className="item muted">No active alerts.</div>}
      </div>
    </article>
  );

  const currentSongPanel = (
    <article className="panel">
      <div className="section-title">Current Song</div>
      {detail ? (
        <div className="list">
          <div className="item">
            <strong>{detail.song.title}</strong>
            <div className="muted">{detail.song.songId} · {detail.song.status}</div>
          </div>
          <div className="item">
            <div className="eyebrow">Brief</div>
            <div className="muted">{excerpt(detail.brief)}</div>
          </div>
          <div className="item">
            <div className="eyebrow">Prompt Ledger</div>
            <strong>{detail.promptLedger.length} entries</strong>
          </div>
          <div className="item">
            <div className="eyebrow">Suno Runs</div>
            <strong>{detail.sunoRuns.length}</strong>
            <div className="muted">{detail.sunoRuns.slice(0, 3).map((run) => `${run.runId}:${run.status}`).join(" · ") || "none"}</div>
          </div>
          <div className="item">
            <div className="eyebrow">Imported Assets</div>
            <strong>{currentImportedAssets(status, sunoStatus).length}</strong>
            <div className="muted">
              {status?.recentSong?.songId ?? detail.song.songId} · last run {status?.lastSunoRun?.runId ?? "none"}
            </div>
            <div className="muted">
              {currentImportedAssets(status, sunoStatus).length
                ? currentImportedAssets(status, sunoStatus)
                  .slice(0, 3)
                  .map((asset) => `${asset.title ?? asset.path.split("/").at(-1) ?? asset.path}:${asset.format}`)
                  .join(" · ")
                : "No imported assets yet"}
            </div>
          </div>
          <div className="item">
            <div className="eyebrow">Latest Prompt Pack</div>
            <strong>{detail.latestPromptPack ? `v${detail.latestPromptPack.version}` : "none"}</strong>
            <div className="muted">take selections {detail.takeSelections.length}</div>
          </div>
          <div className="item">
            <div className="eyebrow">Selected Take</div>
            <strong>{detail.selectedTake?.selectedTakeId ?? "none"}</strong>
            <div className="muted">{detail.takeHistory?.slice(0, 3).map((take) => `${take.selectedTakeId} · ${take.reason}`).join(" · ") || "no take history"}</div>
          </div>
          <div className="item">
            <div className="eyebrow">Social Assets</div>
            <strong>{detail.socialAssets?.length ?? 0}</strong>
            <div className="muted">{detail.socialAssets?.map((asset) => `${asset.platform}:${asset.postType}`).join(" · ") || "none yet"}</div>
          </div>
          <div className="item">
            <div className="eyebrow">Last Social Action</div>
            <strong>{detail.lastSocialAction ? `${detail.lastSocialAction.platform}:${detail.lastSocialAction.action}` : "none"}</strong>
            <div className="muted">{detail.lastSocialAction?.url ?? (detail.lastSocialAction?.accepted ? "accepted without URL" : "no publish yet")}</div>
          </div>
        </div>
      ) : <div className="item muted">No current song.</div>}
    </article>
  );

  const promptLedgerPanel = (
    <article className="panel">
      <div className="section-title">Prompt Ledger</div>
      <div className="list">
        {promptLedgerEntries.length ? promptLedgerEntries.slice(0, 16).map((record, index) => (
          <div className="item" key={`${record.timestamp ?? "entry"}-${index}`}>
            <strong>{record.stage ?? "unknown_stage"}</strong>
            <div className="muted">{record.timestamp ?? "no timestamp"}{record.runId ? ` · ${record.runId}` : ""}{record.songId ? ` · ${record.songId}` : ""}</div>
            <div className="muted">{record.outputSummary ?? record.artistReason ?? "No summary."}</div>
          </div>
        )) : <div className="item muted">No prompt ledger entries for the selected song.</div>}
      </div>
    </article>
  );

  const auditPanel = (
    <article className="panel">
      <div className="section-title">Audit Log</div>
      <div className="list">
        {auditEntries.length ? auditEntries.slice(0, 12).map((entry, index) => (
          <div className="item" key={`${entry.timestamp}-${index}`}>
            <strong>{entry.eventType ?? "audit_event"}</strong>
            <div className="muted">{entry.timestamp} · {entry.songId ?? "global"} · {entry.actor ?? "system"}</div>
            <div className="muted">{entry.details ? JSON.stringify(entry.details) : "No extra details."}</div>
          </div>
        )) : <div className="item muted">No audit entries yet.</div>}
      </div>
    </article>
  );

  const artistMindPanel = (
    <article className="panel">
      <div className="section-title">Artist Mind</div>
      <div className="list">
        <div className="item">
          <div className="eyebrow">ARTIST.md</div>
          <pre className="mind-block">{artistMind?.artist.trim() || "No artist constitution loaded."}</pre>
        </div>
        <div className="item">
          <div className="eyebrow">CURRENT_STATE.md</div>
          <pre className="mind-block">{artistMind?.currentState.trim() || "No current state yet."}</pre>
        </div>
        <div className="item">
          <div className="eyebrow">SOCIAL_VOICE.md</div>
          <pre className="mind-block">{artistMind?.socialVoice.trim() || "No social voice file yet."}</pre>
        </div>
        <div className="item">
          <div className="eyebrow">SONGBOOK.md</div>
          <pre className="mind-block">{artistMind?.songbook.trim() || "No songbook yet."}</pre>
        </div>
      </div>
    </article>
  );

  const recoveryPanel = (
    <article className="panel">
      <div className="section-title">Recovery</div>
      <div className="list">
        <div className="item">
          <strong>{recovery?.diagnostics.blockedReason ?? recovery?.autopilot.lastError ?? "No active block."}</strong>
          <div className="muted">autopilot stage {recovery?.autopilot.stage ?? status?.autopilot.stage ?? "-"}</div>
        </div>
        <div className="inline-actions">
          <button disabled={busy !== null} onClick={() => void runAction("pause")}>Pause</button>
          <button disabled={busy !== null} onClick={() => void runAction("resume")}>Resume</button>
          <button disabled={busy !== null} onClick={() => void runSunoAction("connect")}>Suno Connect</button>
          <button disabled={busy !== null} onClick={() => void runSunoAction("reconnect")}>Suno Reconnect</button>
          <button className="primary" disabled={busy !== null} onClick={() => void runAction("run-cycle")}>Run Recovery Cycle</button>
        </div>
        <div className="item">
          <div className="eyebrow">Distribution Block</div>
          <div className="muted">{recovery?.distributionWorker.blockedReason ?? status?.distributionWorker.blockedReason ?? "distribution ready"}</div>
        </div>
        <div className="item">
          <div className="eyebrow">Diagnostics</div>
          <div className="muted">workspace {recovery?.diagnostics.workspaceRoot ?? "-"}</div>
          <div className="muted">song {recovery?.diagnostics.currentSongId ?? recovery?.diagnostics.recentSongId ?? "none"} · run {recovery?.diagnostics.currentRunId ?? "none"}</div>
        </div>
        <div className="item">
          <div className="eyebrow">Recent Recovery Audit</div>
          <div className="muted">
            {recovery?.recentAudit.length
              ? recovery.recentAudit.slice(0, 5).map((entry) => `${entry.eventType ?? "audit"}:${entry.songId ?? "global"}`).join(" · ")
              : "No recent audit entries."}
          </div>
        </div>
      </div>
    </article>
  );

  return (
    <main className="console-shell">
      <header className="hero">
        <div>
          <div className="eyebrow">Producer Console</div>
          <h1>Artist Runtime</h1>
          <p className="hero-copy">Runtime-first control tower for songs, alerts, budgets, and safe autonomous cycles.</p>
        </div>
        <div className="hero-actions">
          <button disabled={busy !== null} onClick={() => void runAction("pause")}>Pause</button>
          <button disabled={busy !== null} onClick={() => void runAction("resume")}>Resume</button>
          <button disabled={busy !== null} onClick={() => void runAction("ideate")}>Ideate Song</button>
          <button className="primary" disabled={busy !== null} onClick={() => void runAction("run-cycle")}>Run Cycle</button>
        </div>
      </header>

      {error ? <section className="panel error-banner">{error}</section> : null}

      <section className="card-grid">
        <MetricCard
          label="Autopilot"
          value={status?.autopilot.stage ?? "-"}
          detail={status ? `${status.autopilot.nextAction} · ${status.autopilot.blockedReason ?? status.autopilot.currentRunId ?? "no run"}` : "loading"}
        />
        <MetricCard
          label="Ticker"
          value={status?.ticker.lastOutcome ?? "never"}
          detail={status?.ticker.lastTickAt ? `${status.ticker.lastTickAt} · ${status.ticker.intervalMs}ms` : status ? `interval ${status.ticker.intervalMs}ms` : "loading"}
        />
        <MetricCard
          label="Suno"
          value={status?.sunoWorker.state ?? "-"}
          detail={status?.sunoWorker.pendingAction ?? status?.sunoWorker.hardStopReason ?? "worker ready"}
        />
        <MetricCard
          label="Music Budget"
          value={status ? `${status.musicSummary.monthlyRuns}/${status.musicSummary.monthlyGenerationBudget}` : "-"}
          detail={status ? `today ${status.musicSummary.dailyRuns} · prompt pack ${status.musicSummary.latestPromptPackVersion ?? "none"}` : "loading"}
        />
        <MetricCard
          label="Distribution"
          value={status ? `${status.distributionSummary.postsToday} posts` : "-"}
          detail={status ? `${status.distributionSummary.repliesToday} replies · ${status.distributionWorker.blockedReason ?? status.distributionSummary.lastPlatform ?? "no platform yet"}` : "loading"}
        />
        <MetricCard
          label="Setup"
          value={status ? `${status.setupReadiness.completeCount}/${status.setupReadiness.totalCount}` : "-"}
          detail={status ? `${status.setupReadiness.readyForAutopilot ? "ready for live autopilot" : "setup incomplete"} · ${status.setupReadiness.nextRecommendedAction}` : "loading"}
        />
      </section>

      <nav className="view-tabs" aria-label="Producer Console pages">
        {consoleViews.map((view) => (
          <button
            key={view.id}
            className={`tab-button${activeView === view.id ? " is-active" : ""}`}
            disabled={busy !== null && activeView !== view.id}
            onClick={() => setActiveView(view.id)}
          >
            {view.label}
          </button>
        ))}
      </nav>

      {activeView === "dashboard" ? <section className="two-column">{setupPanel}{alertsPanel}{currentSongPanel}{distributionWorkerPanel}{recentXResultPanel}</section> : null}
      {activeView === "setup" ? <section className="two-column">{setupPanel}{sunoPanel}{platformsPanel}{configPanel}</section> : null}
      {activeView === "music" ? <section className="two-column">{sunoPanel}{currentSongPanel}{recentXResultPanel}</section> : null}
      {activeView === "platforms" ? <section className="two-column">{platformsPanel}{distributionWorkerPanel}{replySimulationPanel}</section> : null}
      {activeView === "songs" ? <section className="two-column">{songsPanel}{currentSongPanel}</section> : null}
      {activeView === "prompt-ledger" ? <section className="two-column">{songsPanel}{promptLedgerPanel}</section> : null}
      {activeView === "alerts" ? <section className="two-column">{alertsPanel}{auditPanel}</section> : null}
      {activeView === "artist-mind" ? <section className="single-column">{artistMindPanel}</section> : null}
      {activeView === "settings" ? <section className="two-column">{configPanel}{setupPanel}</section> : null}
      {activeView === "recovery" ? <section className="two-column">{recoveryPanel}{sunoPanel}{alertsPanel}</section> : null}

      <section className="panel debug-panel">
        <div className="section-title">Status Debug</div>
        <pre>{JSON.stringify(status, null, 2)}</pre>
      </section>
    </main>
  );
}
