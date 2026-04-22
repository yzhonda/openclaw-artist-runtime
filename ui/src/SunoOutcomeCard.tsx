type SunoOutcome = {
  runId: string;
  accepted?: boolean;
  urlCount?: number;
  pathCount?: number;
  paths?: string[];
  metadata?: ImportedAsset[];
  reason?: string;
  at: string;
  dryRun?: boolean;
};

export type ImportedAsset = {
  url: string;
  path: string;
  format: "mp3" | "m4a";
  title?: string;
  durationSec?: number;
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
};

export function buildImportedAssetRows(outcome?: SunoOutcome): ImportedAsset[] {
  if (!outcome) {
    return [];
  }

  if (outcome.metadata?.length) {
    return outcome.metadata;
  }

  return (outcome.paths ?? []).map((path, index) => ({
    url: outcome.runId,
    path,
    format: path.toLowerCase().endsWith(".m4a") ? "m4a" : "mp3",
    title: `Imported asset ${index + 1}`
  }));
}

export function importedAssetsPlaceholder(outcome?: SunoOutcome): string | null {
  return buildImportedAssetRows(outcome).length === 0 ? "No imported assets yet." : null;
}

function formatDuration(durationSec?: number): string | null {
  if (typeof durationSec !== "number" || !Number.isFinite(durationSec) || durationSec < 0) {
    return null;
  }
  const minutes = Math.floor(durationSec / 60);
  const seconds = Math.floor(durationSec % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function assetHref(path: string): string {
  return path.startsWith("/") ? `file://${path}` : path;
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

export function SunoOutcomeCard(props: SunoOutcomeCardProps) {
  const createOutcome = formatOutcome("Last Create", props.lastCreateOutcome);
  const importOutcome = formatOutcome("Last Import", props.lastImportOutcome);
  const importedAssets = buildImportedAssetRows(props.lastImportOutcome);
  const importedAssetsEmpty = importedAssetsPlaceholder(props.lastImportOutcome);

  return (
    <div className="list">
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
      <div className={`item outcome-item outcome-${createOutcome.tone}`}>
        <div className="outcome-heading">
          <div className="eyebrow">Last Create</div>
          {createOutcome.dryRun ? <span className="badge badge-dry-run">Dry-run</span> : null}
        </div>
        <strong>{createOutcome.title}</strong>
        <div className="muted">{createOutcome.detail}</div>
      </div>
      <div className={`item outcome-item outcome-${importOutcome.tone}`}>
        <div className="outcome-heading">
          <div className="eyebrow">Last Import</div>
          {importOutcome.dryRun ? <span className="badge badge-dry-run">Dry-run</span> : null}
        </div>
        <strong>{importOutcome.title}</strong>
        <div className="muted">{importOutcome.detail}</div>
        <div className="muted">
          {props.lastImportOutcome?.pathCount ?? importedAssets.length} files
          {props.lastImportOutcome?.urlCount !== undefined ? ` · ${props.lastImportOutcome.urlCount} urls` : ""}
        </div>
      </div>
      <div className="item">
        <div className="eyebrow">Imported Assets</div>
        {importedAssetsEmpty ? <div className="muted">{importedAssetsEmpty}</div> : null}
        {importedAssets.length > 0 ? (
          <div className="asset-list">
            {importedAssets.map((asset) => (
              <div className="asset-row" key={`${asset.path}-${asset.url}`}>
                <a className="asset-link" href={assetHref(asset.path)} target="_blank" rel="noreferrer">
                  {asset.title ?? asset.path.split("/").at(-1) ?? asset.path}
                </a>
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
    </div>
  );
}
