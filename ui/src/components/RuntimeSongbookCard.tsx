export type SongbookIssue = {
  songId: string;
  title: string;
  issue: "missing_row" | "status_mismatch" | "missing_apple_music";
  expected?: string;
  actual?: string;
  candidateUrl?: string;
};

export type SongbookRow = {
  songId: string;
  title: string;
  status: string;
  publicLinks: string[];
};

export type SongbookLookupResult = {
  rows: SongbookRow[];
  issues: SongbookIssue[];
  validation?: { rows: SongbookRow[]; issues: SongbookIssue[] };
  updated?: string[];
};

type Props = {
  songbook?: string;
  result?: SongbookLookupResult | null;
  busy: boolean;
  onLookup: () => void;
  onSync: () => void;
};

function issueLabel(issue: SongbookIssue): string {
  if (issue.issue === "status_mismatch") {
    return `${issue.songId}: status ${issue.actual ?? "-"} -> ${issue.expected ?? "-"}`;
  }
  if (issue.issue === "missing_apple_music") {
    return `${issue.songId}: Apple Music link candidate`;
  }
  return `${issue.songId}: missing SONGBOOK row`;
}

export function RuntimeSongbookCard(props: Props) {
  const rows = props.result?.validation?.rows ?? props.result?.rows ?? [];
  const issues = props.result?.validation?.issues ?? props.result?.issues ?? [];
  return (
    <article className="panel">
      <div className="section-title">SONGBOOK Maintenance</div>
      <div className="inline-actions">
        <button disabled={props.busy} onClick={props.onLookup}>Lookup Apple Music</button>
        <button className="primary" disabled={props.busy} onClick={props.onSync}>Sync SONGBOOK</button>
      </div>
      <div className="list">
        <div className="item">
          <strong>{issues.length ? `${issues.length} issue(s)` : "SONGBOOK clean"}</strong>
          <div className="muted">{props.result?.updated?.length ? `updated ${props.result.updated.join(", ")}` : "lookup is manual; autopilot sync requires OPENCLAW_SONGBOOK_AUTO_SYNC=on"}</div>
        </div>
        {issues.slice(0, 6).map((issue) => (
          <div className="item" key={`${issue.songId}-${issue.issue}`}>
            <strong>{issueLabel(issue)}</strong>
            <div className="muted">{issue.candidateUrl ?? "no URL candidate"}</div>
          </div>
        ))}
        {rows.slice(0, 5).map((row) => (
          <div className="item" key={row.songId}>
            <strong>{row.title}</strong>
            <div className="muted">{row.songId} · {row.status} · links {row.publicLinks.length}</div>
          </div>
        ))}
        {!rows.length && !issues.length ? <pre className="mind-block">{props.songbook?.trim() || "No SONGBOOK loaded."}</pre> : null}
      </div>
    </article>
  );
}
