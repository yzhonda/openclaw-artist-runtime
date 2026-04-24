import type { DistributionEvent } from "../../src/types";

export function DistributionEventsCard(props: { events?: DistributionEvent[] }) {
  const events = props.events ?? [];

  return (
    <article className="panel distribution-events-card">
      <div className="section-title">Distribution Recent Events</div>
      {events.length === 0 ? (
        <div className="item muted">No distribution events yet.</div>
      ) : (
        <div className="events-table" role="table" aria-label="Distribution recent events">
          <div className="events-row events-head" role="row">
            <span>Time</span>
            <span>Platform</span>
            <span>Action</span>
            <span>State</span>
            <span>Reason</span>
            <span>URL</span>
          </div>
          {events.slice(0, 20).map((event, index) => (
            <div className={`events-row${event.platform === "tiktok" ? " is-frozen" : ""}`} role="row" key={`${event.timestamp}-${event.platform}-${index}`}>
              <span>{event.timestamp}</span>
              <span>{event.platform}</span>
              <span>{event.action}</span>
              <span>
                <span className={`badge ${event.accepted ? "badge-ok" : event.platform === "tiktok" ? "badge-frozen" : "badge-warning"}`}>
                  {event.accepted ? "accepted" : event.dryRun ? "dry-run" : "blocked"}
                </span>
              </span>
              <span>{event.reason}</span>
              <span>{event.url ?? "-"}</span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
