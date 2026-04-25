import type { DistributionEvent } from "../../src/types";
import { defaultDistributionEventsFilter, filterDistributionEvents, type DistributionEventsFilterState } from "../../src/services/distributionEventsFilter";
import { runbookHref } from "./errorRunbookMap";

export function DistributionEventsCard(props: {
  events?: DistributionEvent[];
  filter?: DistributionEventsFilterState;
  onFilterChange?: (filter: DistributionEventsFilterState) => void;
  onClearFilters?: () => void;
}) {
  const events = props.events ?? [];
  const filter = props.filter ?? defaultDistributionEventsFilter;
  const visibleEvents = filterDistributionEvents(events, filter);
  const updateFilter = (patch: Partial<DistributionEventsFilterState>) => {
    props.onFilterChange?.({ ...filter, ...patch });
  };

  return (
    <article className="panel distribution-events-card">
      <div className="inline-actions">
        <div className="section-title">Distribution Recent Events</div>
        <button type="button" onClick={props.onClearFilters}>Clear Filters</button>
      </div>
      <div className="events-filter-grid">
        <label>
          <span className="eyebrow">Platform</span>
          <select value={filter.platform} onChange={(event) => updateFilter({ platform: event.target.value as DistributionEventsFilterState["platform"] })}>
            <option value="all">All</option>
            <option value="x">X</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
          </select>
        </label>
        <label>
          <span className="eyebrow">Decision</span>
          <select value={filter.decision} onChange={(event) => updateFilter({ decision: event.target.value as DistributionEventsFilterState["decision"] })}>
            <option value="all">All</option>
            <option value="published">Published</option>
            <option value="dryRun">Dry-run</option>
            <option value="blocked">Blocked</option>
          </select>
        </label>
        <label>
          <span className="eyebrow">From</span>
          <input type="date" value={filter.from ?? ""} onChange={(event) => updateFilter({ from: event.target.value || undefined })} />
        </label>
        <label>
          <span className="eyebrow">To</span>
          <input type="date" value={filter.to ?? ""} onChange={(event) => updateFilter({ to: event.target.value || undefined })} />
        </label>
        <label className="events-search">
          <span className="eyebrow">Search</span>
          <input value={filter.search} onChange={(event) => updateFilter({ search: event.target.value })} placeholder="reason, URL, song id..." />
        </label>
      </div>
      {events.length === 0 ? (
        <div className="item muted">No distribution events yet.</div>
      ) : visibleEvents.length === 0 ? (
        <div className="item muted">No distribution events match the current filters.</div>
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
          {visibleEvents.slice(0, 20).map((event, index) => (
            <div className={`events-row${event.platform === "tiktok" ? " is-frozen" : ""}`} role="row" key={`${event.timestamp}-${event.platform}-${index}`}>
              <span>{event.timestamp}</span>
              <span>{event.platform}</span>
              <span>{event.action}</span>
              <span>
                <span className={`badge ${event.accepted ? "badge-ok" : event.platform === "tiktok" ? "badge-frozen" : "badge-warning"}`}>
                  {event.accepted ? "accepted" : event.dryRun ? "dry-run" : "blocked"}
                </span>
              </span>
              <span>
                {runbookHref(event.reason) ? (
                  <a className="runbook-link" href={runbookHref(event.reason)} target="_blank" rel="noreferrer">{event.reason}</a>
                ) : event.reason}
              </span>
              <span>{event.url ?? "-"}</span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
