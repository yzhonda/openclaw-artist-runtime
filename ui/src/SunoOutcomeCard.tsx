import { useEffect, useRef, useState } from "react";
import {
  buildImportedAssetRows,
  filterImportedAssetsByUrlPrefix,
  importedAssetsPlaceholder,
  type SunoImportedAssetView
} from "../../src/services/sunoImportedAssetsView";
import { runbookHref } from "./errorRunbookMap";

export { buildImportedAssetRows, importedAssetsPlaceholder };

export type ImportedAsset = SunoImportedAssetView;

type SunoOutcome = {
  runId: string;
  accepted?: boolean;
  urlCount?: number;
  pathCount?: number;
  paths?: string[];
  metadata?: ImportedAsset[];
  failedUrls?: FailedImportUrl[];
  reason?: string;
  at: string;
  dryRun?: boolean;
};

export type FailedImportUrl = {
  url: string;
  reason: "404" | "network" | "extraction_failed";
};

export type SunoArtifactIndexEntry = {
  runId: string;
  songId?: string;
  path: string;
  size: number;
  format: "mp3" | "m4a";
  createdAt: string;
};

type BudgetResetEntry = {
  timestamp: string;
  consumedBefore: number;
  reason: string;
};

export type SunoOutcomeCardProps = {
  state: string;
  pendingAction?: string;
  hardStopReason?: string;
  currentSongId?: string;
  currentRunId?: string;
  lastImportedRunId?: string;
  lastCreateOutcome?: SunoOutcome;
  lastImportOutcome?: SunoOutcome;
  budget?: {
    date: string;
    consumed: number;
    limit: number;
    remaining: number;
    lastResetAt?: string;
    resetHistory?: BudgetResetEntry[];
    monthly?: {
      month: string;
      consumed: number;
      limit: number;
      remaining: number;
      unlimited: boolean;
    };
  };
  artifacts?: SunoArtifactIndexEntry[];
  profile?: {
    stale?: boolean;
    detail?: string;
    checkedAt?: string;
  };
  onResetBudget?: () => Promise<void>;
  budgetResetDisabled?: boolean;
};

function formatDuration(durationSec?: number): string | null {
  if (typeof durationSec !== "number" || !Number.isFinite(durationSec) || durationSec < 0) {
    return null;
  }

  const minutes = Math.floor(durationSec / 60);
  const seconds = Math.floor(durationSec % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatOutcome(
  label: string,
  outcome?: SunoOutcome
): { title: string; detail: string; tone: "ok" | "blocked" | "idle"; dryRun: boolean } {
  if (!outcome) {
    return {
      title: `${label}: -`,
      detail: "No outcome recorded yet.",
      tone: "idle",
      dryRun: false
    };
  }

  const accepted = typeof outcome.accepted === "boolean" ? outcome.accepted : (outcome.urlCount ?? 0) > 0;
  const title = `${label}: ${accepted ? "ok" : "blocked"}`;
  const detailParts = [`run ${outcome.runId}`, outcome.reason ?? null, outcome.at];
  return {
    title,
    detail: detailParts.filter(Boolean).join(" · "),
    tone: accepted ? "ok" : "blocked",
    dryRun: Boolean(outcome.dryRun)
  };
}

function ReasonDetail(props: { detail: string; reason?: string }) {
  const href = runbookHref(props.reason);
  if (!href || !props.reason) {
    return <div className="muted">{props.detail}</div>;
  }

  const parts = props.detail.split(props.reason);
  return (
    <div className="muted">
      {parts[0]}
      <a className="runbook-link" href={href} target="_blank" rel="noreferrer">{props.reason}</a>
      {parts.slice(1).join(props.reason)}
    </div>
  );
}

function nextUtcRolloverLabel(now = new Date()): string {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const diffMs = Math.max(0, next.getTime() - now.getTime());
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  const minutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
  return `${hours}:${minutes.toString().padStart(2, "0")}`;
}

export function SunoOutcomeCard(props: SunoOutcomeCardProps) {
  const createOutcome = formatOutcome("Last Create", props.lastCreateOutcome);
  const importOutcome = formatOutcome("Last Import", props.lastImportOutcome);
  const importedAssets = buildImportedAssetRows(props.lastImportOutcome);
  const importedAssetsEmpty = importedAssetsPlaceholder(props.lastImportOutcome);
  const [assetUrlPrefix, setAssetUrlPrefix] = useState("");
  const visibleImportedAssets = filterImportedAssetsByUrlPrefix(importedAssets, assetUrlPrefix);
  const failedUrls = props.lastImportOutcome?.failedUrls ?? [];
  const artifacts = props.artifacts ?? [];
  const [copyFeedback, setCopyFeedback] = useState<Record<string, "copied" | "failed">>({});
  const [resetFeedback, setResetFeedback] = useState<"failed" | null>(null);
  const copyTimers = useRef<Record<string, number>>({});
  const resetTimer = useRef<number | null>(null);
  const budgetRatio = props.budget && props.budget.limit > 0
    ? Math.min(props.budget.consumed / props.budget.limit, 1)
    : 0;
  const monthlyBudgetRatio = props.budget?.monthly && props.budget.monthly.limit > 0
    ? Math.min(props.budget.monthly.consumed / props.budget.monthly.limit, 1)
    : 0;
  const monthlyBudgetTone = !props.budget?.monthly || props.budget.monthly.unlimited
    ? "idle"
    : monthlyBudgetRatio >= 1
      ? "error"
        : monthlyBudgetRatio >= 0.8
        ? "warning"
        : "ok";
  const budgetTone = !props.budget || props.budget.limit <= 0
    ? "idle"
    : budgetRatio >= 1
      ? "error"
        : budgetRatio >= 0.8
        ? "warning"
        : "ok";

  useEffect(() => () => {
    Object.values(copyTimers.current).forEach((timer) => window.clearTimeout(timer));
    if (resetTimer.current) {
      window.clearTimeout(resetTimer.current);
    }
  }, []);

  function clearResetFeedbackSoon(): void {
    if (resetTimer.current) {
      window.clearTimeout(resetTimer.current);
    }
    resetTimer.current = window.setTimeout(() => {
      setResetFeedback(null);
      resetTimer.current = null;
    }, 1500);
  }

  async function copyAssetPath(path: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(path);
      setCopyFeedback((current) => ({ ...current, [path]: "copied" }));
    } catch {
      setCopyFeedback((current) => ({ ...current, [path]: "failed" }));
    }

    if (copyTimers.current[path]) {
      window.clearTimeout(copyTimers.current[path]);
    }
    copyTimers.current[path] = window.setTimeout(() => {
      setCopyFeedback((current) => {
        const next = { ...current };
        delete next[path];
        return next;
      });
      delete copyTimers.current[path];
    }, 1500);
  }

  async function resetBudget(): Promise<void> {
    if (!props.onResetBudget) {
      return;
    }
    if (!window.confirm("Reset the daily Suno credit budget to 0?")) {
      return;
    }
    try {
      await props.onResetBudget();
      setResetFeedback(null);
    } catch {
      setResetFeedback("failed");
      clearResetFeedbackSoon();
    }
  }

  return (
    <div className="list">
      {props.profile?.stale ? (
        <div className="item suno-profile-stale">
          <div className="eyebrow">Suno Profile</div>
          <strong>Profile looks stale</strong>
          <div className="muted">
            {props.profile.detail ?? "Run scripts/suno-profile-diagnose.sh manually on the operator machine. No console action runs the script."}
          </div>
          {props.profile.checkedAt ? <div className="muted">checked {props.profile.checkedAt}</div> : null}
        </div>
      ) : null}
      <div className="item">
        <strong>{props.state || "-"}</strong>
        <div className="muted">{props.pendingAction ?? props.hardStopReason ?? "No pending operator step."}</div>
      </div>
      <div className="item">
        <div className="eyebrow">Suno Current Run</div>
        <strong>{props.currentRunId ?? "-"}</strong>
        <div className="muted">song {props.currentSongId ?? "-"}</div>
      </div>
      <div className="item">
        <div className="eyebrow">Last Imported</div>
        <strong>{props.lastImportedRunId ?? "-"}</strong>
        <div className="muted">{props.lastImportOutcome?.at ?? "No import recorded yet."}</div>
      </div>
      <div className={`item budget-item budget-${budgetTone}`}>
        <div className="eyebrow">Daily Credit Budget</div>
        {props.budget ? (
          <>
            <strong>{props.budget.remaining} remaining</strong>
            <div className="budget-tooltip">
              Last reset: {props.budget.lastResetAt ?? "none"} · Next UTC rollover: {nextUtcRolloverLabel()}
            </div>
            <div className="muted">
              {props.budget.consumed}/{props.budget.limit} consumed · UTC {props.budget.date}
            </div>
            {props.budget.lastResetAt ? <div className="muted">last reset {props.budget.lastResetAt}</div> : null}
            <div className="budget-progress" aria-hidden="true">
              <div className={`budget-progress-bar budget-progress-${budgetTone}`} style={{ width: `${budgetRatio * 100}%` }} />
            </div>
            {props.budget.monthly ? (
              <div className={`budget-monthly budget-${monthlyBudgetTone}`}>
                <div className="muted">
                  Monthly {props.budget.monthly.unlimited
                    ? `${props.budget.monthly.consumed} consumed · unlimited · UTC ${props.budget.monthly.month}`
                    : `${props.budget.monthly.consumed}/${props.budget.monthly.limit} consumed · UTC ${props.budget.monthly.month}`}
                </div>
                <div className="budget-progress" aria-hidden="true">
                  <div className={`budget-progress-bar budget-progress-${monthlyBudgetTone}`} style={{ width: `${monthlyBudgetRatio * 100}%` }} />
                </div>
              </div>
            ) : null}
            <div className="inline-actions budget-actions">
              <button type="button" className="budget-reset-button" disabled={props.budgetResetDisabled} onClick={() => void resetBudget()}>Reset budget</button>
              {resetFeedback === "failed" ? <span className="field-error">reset failed</span> : null}
            </div>
            {props.budget.resetHistory?.length ? (
              <div className="reset-history">
                <div className="eyebrow">Recent Resets</div>
                {props.budget.resetHistory.slice(0, 5).map((entry) => (
                  <div className="mini-row" key={`${entry.timestamp}-${entry.reason}`}>
                    <span>{entry.timestamp}</span>
                    <span>{entry.consumedBefore} before</span>
                    <span>{entry.reason}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <div className="muted">No budget state yet.</div>
        )}
      </div>
      <div className={`item outcome-item outcome-${createOutcome.tone}`}>
        <div className="outcome-heading">
          <div className="eyebrow">Last Create</div>
          {createOutcome.dryRun ? <span className="badge badge-dry-run">Dry-run</span> : null}
        </div>
        <strong>{createOutcome.title}</strong>
        <ReasonDetail detail={createOutcome.detail} reason={props.lastCreateOutcome?.reason} />
      </div>
      <div className={`item outcome-item outcome-${importOutcome.tone}`}>
        <div className="outcome-heading">
          <div className="eyebrow">Last Import</div>
          {importOutcome.dryRun ? <span className="badge badge-dry-run">Dry-run</span> : null}
        </div>
        <strong>{importOutcome.title}</strong>
        <ReasonDetail detail={importOutcome.detail} reason={props.lastImportOutcome?.reason} />
        <div className="muted">
          {props.lastImportOutcome?.pathCount ?? importedAssets.length} files
          {props.lastImportOutcome?.urlCount !== undefined ? ` · ${props.lastImportOutcome.urlCount} urls` : ""}
        </div>
        {failedUrls.length > 0 ? (
          <details className="failed-url-list">
            <summary>{failedUrls.length} failed URL(s)</summary>
            {failedUrls.map((failure) => (
              <div className="mini-row failed-url-row" key={`${failure.url}-${failure.reason}`}>
                <span>{failure.reason}</span>
                <span>{failure.url}</span>
              </div>
            ))}
          </details>
        ) : null}
      </div>
      <div className="item">
        <div className="eyebrow">Imported Assets</div>
        {importedAssetsEmpty ? <div className="muted">{importedAssetsEmpty}</div> : null}
        {importedAssets.length > 0 ? (
          <div className="asset-list">
            <label className="asset-filter">
              <span>Filter by URL prefix</span>
              <input
                type="text"
                placeholder="https://suno.com/song/..."
                value={assetUrlPrefix}
                onChange={(event) => setAssetUrlPrefix(event.target.value)}
              />
            </label>
            {visibleImportedAssets.length === 0 ? <div className="muted">No imported assets match this URL prefix.</div> : null}
            {visibleImportedAssets.map((asset) => (
              <div className="asset-row" key={`${asset.path}-${asset.url}`}>
                <div className="asset-row-header">
                  <strong className="asset-link">{asset.title ?? asset.path.split("/").at(-1) ?? asset.path}</strong>
                  <button
                    type="button"
                    className={`asset-copy-button${copyFeedback[asset.path] ? ` is-${copyFeedback[asset.path]}` : ""}`}
                    aria-label={`copy path for ${asset.title ?? asset.path.split("/").at(-1) ?? asset.path}`}
                    onClick={() => void copyAssetPath(asset.path)}
                  >
                    {copyFeedback[asset.path] === "copied"
                      ? "copied"
                      : copyFeedback[asset.path] === "failed"
                        ? "copy failed"
                        : "copy path"}
                  </button>
                </div>
                <div className="muted">
                  {asset.format}
                  {formatDuration(asset.durationSec) ? ` · ${formatDuration(asset.durationSec)}` : ""}
                  {asset.path ? ` · ${asset.path}` : ""}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="item">
        <div className="eyebrow">Runtime Artifacts</div>
        {artifacts.length === 0 ? <div className="muted">No runtime artifacts indexed yet.</div> : null}
        {artifacts.length > 0 ? (
          <div className="artifact-index-list">
            {artifacts.slice(0, 8).map((artifact) => (
              <div className="asset-row" key={`${artifact.runId}-${artifact.path}`}>
                <div className="asset-row-header">
                  <strong>{artifact.path.split("/").at(-1) ?? artifact.path}</strong>
                  <span className="badge badge-dry-run">{artifact.format}</span>
                </div>
                <div className="muted">
                  run {artifact.runId}
                  {artifact.songId ? ` · song ${artifact.songId}` : ""}
                  {` · ${artifact.size} bytes · ${artifact.createdAt}`}
                </div>
                <div className="muted">{artifact.path}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
