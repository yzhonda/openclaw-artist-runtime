import { startTransition, useEffect, useState } from "react";
import "./styles.css";

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
  sunoWorker: {
    state: string;
    hardStopReason?: string;
    pendingAction?: string;
  };
  distributionWorker: {
    enabled: boolean;
    dryRun: boolean;
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
};

type ConfigResponse = {
  artist: {
    artistId: string;
    workspaceRoot: string;
  };
  autopilot: {
    enabled: boolean;
    dryRun: boolean;
  };
  distribution: {
    platforms: {
      x: { enabled: boolean };
      instagram: { enabled: boolean };
      tiktok: { enabled: boolean };
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
  lastSocialAction?: { platform: string; action: string; accepted: boolean; url?: string };
};

type PlatformDetail = {
  connected: boolean;
  authority: string;
  postsToday?: number;
  repliesToday?: number;
  accountLabel?: string;
  reason?: string;
  capabilitySummary?: Record<string, boolean | "unknown">;
};

type ConfigDraft = {
  autopilotEnabled: boolean;
  dryRun: boolean;
  xEnabled: boolean;
  instagramEnabled: boolean;
  tiktokEnabled: boolean;
};

type SunoStatusResponse = {
  worker: {
    state: string;
    hardStopReason?: string;
    pendingAction?: string;
  };
  currentSongId?: string;
  latestRun?: { runId: string; status: string };
  recentRuns: Array<{ runId: string; status: string; urls: string[] }>;
  latestPromptPackVersion?: number;
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
  const [platformTests, setPlatformTests] = useState<Record<string, { testedAt: string; status: PlatformDetail }>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async (preferredSongId?: string | null) => {
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
        setConfigDraft({
          autopilotEnabled: nextConfig.autopilot.enabled,
          dryRun: nextConfig.autopilot.dryRun,
          xEnabled: nextConfig.distribution.platforms.x.enabled,
          instagramEnabled: nextConfig.distribution.platforms.instagram.enabled,
          tiktokEnabled: nextConfig.distribution.platforms.tiktok.enabled
        });
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
    }
  };

  useEffect(() => {
    void refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    setBusy("config");
    try {
      await apiPost("/config/update", {
        patch: {
          autopilot: {
            enabled: configDraft.autopilotEnabled,
            dryRun: configDraft.dryRun
          },
          distribution: {
            platforms: {
              x: { enabled: configDraft.xEnabled },
              instagram: { enabled: configDraft.instagramEnabled },
              tiktok: { enabled: configDraft.tiktokEnabled }
            }
          }
        }
      });
      await refresh(selectedSongId);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
    } finally {
      setBusy(null);
    }
  };

  const testPlatform = async (platform: "x" | "instagram" | "tiktok") => {
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
      </div>
    </article>
  );

  const sunoPanel = (
    <article className="panel">
      <div className="section-title">Suno</div>
      <div className="list">
        <div className="item">
          <strong>{sunoStatus?.worker.state ?? "-"}</strong>
          <div className="muted">{sunoStatus?.worker.pendingAction ?? sunoStatus?.worker.hardStopReason ?? "No pending operator step."}</div>
        </div>
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
      <div className="section-title">Settings</div>
      {config && configDraft ? (
        <div className="config-form">
          <label className="toggle"><input type="checkbox" checked={configDraft.autopilotEnabled} onChange={(event) => setConfigDraft({ ...configDraft, autopilotEnabled: event.target.checked })} />Autopilot enabled</label>
          <label className="toggle"><input type="checkbox" checked={configDraft.dryRun} onChange={(event) => setConfigDraft({ ...configDraft, dryRun: event.target.checked })} />Dry-run safety</label>
          <label className="toggle"><input type="checkbox" checked={configDraft.xEnabled} onChange={(event) => setConfigDraft({ ...configDraft, xEnabled: event.target.checked })} />X enabled</label>
          <label className="toggle"><input type="checkbox" checked={configDraft.instagramEnabled} onChange={(event) => setConfigDraft({ ...configDraft, instagramEnabled: event.target.checked })} />Instagram enabled</label>
          <label className="toggle"><input type="checkbox" checked={configDraft.tiktokEnabled} onChange={(event) => setConfigDraft({ ...configDraft, tiktokEnabled: event.target.checked })} />TikTok enabled</label>
          <div className="muted">artist {config.artist.artistId} · workspace {config.artist.workspaceRoot}</div>
          <div className="inline-actions">
            <button className="primary" disabled={busy !== null} onClick={() => void saveConfig()}>Save Settings</button>
            <button disabled={busy !== null} onClick={() => void refresh(selectedSongId)}>Refresh</button>
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
        {status ? Object.entries(status.platforms).map(([platform, value]) => (
          <div className="item" key={platform}>
            <div className="inline-actions">
              <strong>{platform}</strong>
              <div className="inline-actions">
                <button disabled={busy !== null} onClick={() => void testPlatform(platform as "x" | "instagram" | "tiktok")}>Test</button>
                <button disabled={busy !== null} onClick={() => void togglePlatform(platform as "x" | "instagram" | "tiktok", !platformEnabled(configDraft, platform as "x" | "instagram" | "tiktok"))}>
                  {platformEnabled(configDraft, platform as "x" | "instagram" | "tiktok") ? "Disable" : "Enable"}
                </button>
              </div>
            </div>
            <div className="muted">{value.connected ? "connected" : "offline"} · {value.authority}</div>
            <div className="muted">posts {value.postsToday ?? 0} · replies {value.repliesToday ?? 0}</div>
            {platformTests[platform] ? (
              <div className="muted">tested {platformTests[platform].testedAt} · {platformTests[platform].status.reason ?? "ok"}</div>
            ) : null}
          </div>
        )) : <div className="item muted">Loading platforms.</div>}
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

      {activeView === "dashboard" ? <section className="two-column">{setupPanel}{alertsPanel}{currentSongPanel}{distributionWorkerPanel}</section> : null}
      {activeView === "setup" ? <section className="two-column">{setupPanel}{sunoPanel}{platformsPanel}{configPanel}</section> : null}
      {activeView === "music" ? <section className="two-column">{sunoPanel}{currentSongPanel}</section> : null}
      {activeView === "platforms" ? <section className="two-column">{platformsPanel}{distributionWorkerPanel}</section> : null}
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
