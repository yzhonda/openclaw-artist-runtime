import { startTransition, useEffect, useState } from "react";
import "./styles.css";

type StatusResponse = {
  autopilot: {
    stage: string;
    nextAction: string;
    currentRunId?: string;
    currentSongId?: string;
  };
  sunoWorker: {
    state: string;
    hardStopReason?: string;
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

type SongSummary = {
  songId: string;
  title: string;
  status: string;
  runCount: number;
  selectedTakeId?: string;
};

type SongDetail = {
  song: SongSummary;
  promptLedger: unknown[];
  sunoRuns: unknown[];
  latestPromptPack?: { version: number };
};

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

export function App() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [songs, setSongs] = useState<SongSummary[]>([]);
  const [detail, setDetail] = useState<SongDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setError(null);
      const nextStatus = await apiGet<StatusResponse>("/status");
      const nextSongs = await apiGet<SongSummary[]>("/songs");
      const nextDetail = nextStatus.recentSong
        ? await apiGet<SongDetail>(`/songs/${nextStatus.recentSong.songId}`)
        : null;
      startTransition(() => {
        setStatus(nextStatus);
        setSongs(nextSongs);
        setDetail(nextDetail);
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const runAction = async (action: "pause" | "resume" | "run-cycle") => {
    setBusy(action);
    try {
      if (action === "pause") {
        await apiPost("/pause");
      } else if (action === "resume") {
        await apiPost("/resume");
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
          <button className="primary" disabled={busy !== null} onClick={() => void runAction("run-cycle")}>Run Cycle</button>
        </div>
      </header>

      {error ? <section className="panel error-banner">{error}</section> : null}

      <section className="card-grid">
        <MetricCard
          label="Autopilot"
          value={status?.autopilot.stage ?? "-"}
          detail={`${status?.autopilot.nextAction ?? "idle"} · ${status?.autopilot.currentRunId ?? "no run"}`}
        />
        <MetricCard
          label="Suno"
          value={status?.sunoWorker.state ?? "-"}
          detail={status?.sunoWorker.hardStopReason ?? "worker ready"}
        />
        <MetricCard
          label="Music Budget"
          value={status ? `${status.musicSummary.monthlyRuns}/${status.musicSummary.monthlyGenerationBudget}` : "-"}
          detail={status ? `today ${status.musicSummary.dailyRuns} · prompt pack ${status.musicSummary.latestPromptPackVersion ?? "none"}` : "loading"}
        />
        <MetricCard
          label="Distribution"
          value={status ? `${status.distributionSummary.postsToday} posts` : "-"}
          detail={status ? `${status.distributionSummary.repliesToday} replies · ${status.distributionSummary.lastPlatform ?? "no platform yet"}` : "loading"}
        />
      </section>

      <section className="two-column">
        <article className="panel">
          <div className="section-title">Songs</div>
          <div className="list">
            {songs.length > 0 ? songs.map((song) => (
              <div className="item" key={song.songId}>
                <span className="pill">{song.status}</span>
                <strong>{song.title}</strong>
                <div className="muted">{song.songId} · runs {song.runCount}{song.selectedTakeId ? ` · take ${song.selectedTakeId}` : ""}</div>
              </div>
            )) : <div className="item muted">No songs yet.</div>}
          </div>
        </article>

        <article className="panel">
          <div className="section-title">Alerts</div>
          <div className="list">
            {status?.alerts.length ? status.alerts.map((alert) => (
              <div className={`item alert-${alert.severity}`} key={alert.id}>
                <strong>{alert.message}</strong>
                <div className="muted">{alert.source}{alert.ackedAt ? " · acknowledged" : ""}</div>
              </div>
            )) : <div className="item muted">No active alerts.</div>}
          </div>
        </article>
      </section>

      <section className="two-column">
        <article className="panel">
          <div className="section-title">Current Song</div>
          {detail ? (
            <div className="list">
              <div className="item">
                <strong>{detail.song.title}</strong>
                <div className="muted">{detail.song.songId} · {detail.song.status}</div>
              </div>
              <div className="item">
                <div className="eyebrow">Prompt Ledger</div>
                <strong>{detail.promptLedger.length} entries</strong>
              </div>
              <div className="item">
                <div className="eyebrow">Suno Runs</div>
                <strong>{detail.sunoRuns.length}</strong>
              </div>
              <div className="item">
                <div className="eyebrow">Latest Prompt Pack</div>
                <strong>{detail.latestPromptPack ? `v${detail.latestPromptPack.version}` : "none"}</strong>
              </div>
            </div>
          ) : <div className="item muted">No current song.</div>}
        </article>

        <article className="panel">
          <div className="section-title">Platforms</div>
          <div className="list">
            {status ? Object.entries(status.platforms).map(([platform, value]) => (
              <div className="item" key={platform}>
                <strong>{platform}</strong>
                <div className="muted">{value.connected ? "connected" : "offline"} · {value.authority}</div>
                <div className="muted">posts {value.postsToday ?? 0} · replies {value.repliesToday ?? 0}</div>
              </div>
            )) : <div className="item muted">Loading platforms.</div>}
          </div>
        </article>
      </section>

      <section className="panel debug-panel">
        <div className="section-title">Status Debug</div>
        <pre>{JSON.stringify(status, null, 2)}</pre>
      </section>
    </main>
  );
}
