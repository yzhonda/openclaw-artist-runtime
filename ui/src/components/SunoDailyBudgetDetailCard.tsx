import React from "react";

export interface SunoBudgetDetail {
  todayCalls: Array<{
    timestamp: string;
    amount: number;
    kind: "consume";
  }>;
  lastResetAt: string;
  remaining: number;
  used: number;
  limit: number;
}

function timeLabel(value: string): string {
  return new Date(value).toLocaleString();
}

export function SunoDailyBudgetDetailCard(props: { detail?: SunoBudgetDetail }) {
  const detail = props.detail;
  const percent = detail && detail.limit > 0 ? Math.min(100, Math.round((detail.used / detail.limit) * 100)) : 0;
  return (
    <article className="panel suno-budget-detail-card">
      <div className="section-title">Suno Daily Budget Detail</div>
      {detail ? (
        <>
          <div className="item">
            <div className="eyebrow">Today</div>
            <strong>{detail.used}/{detail.limit} credits</strong>
            <div className="budget-progress" aria-label="Suno daily budget detail">
              <div className="budget-progress-bar budget-progress-ok" style={{ width: `${percent}%` }} />
            </div>
            <div className="muted">{detail.remaining} remaining · last reset {timeLabel(detail.lastResetAt)}</div>
          </div>
          <div className="list">
            {detail.todayCalls.length ? detail.todayCalls.map((call) => (
              <div className="item" key={`${call.timestamp}-${call.amount}`}>
                <strong>{call.amount} credit{call.amount === 1 ? "" : "s"}</strong>
                <div className="muted">{call.kind} · {timeLabel(call.timestamp)}</div>
              </div>
            )) : <div className="item muted">No Suno budget calls today.</div>}
          </div>
        </>
      ) : <div className="item muted">Loading Suno budget detail.</div>}
    </article>
  );
}
