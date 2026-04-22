type SunoOutcome = {
  runId: string;
  accepted?: boolean;
  urlCount?: number;
  reason?: string;
  at: string;
  dryRun?: boolean;
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
      </div>
    </div>
  );
}
