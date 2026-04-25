import { useState, type ReactNode } from "react";
import { DistributionEventsCard } from "./DistributionEventsCard";
import { PlatformUptimeCard } from "./PlatformUptimeCard";
import type { DistributionEventsFilterState } from "../../src/services/distributionEventsFilter";
import type { DistributionEvent, PlatformStatus, PlatformStat, SocialPlatform } from "../../src/types";

type ObservabilityTab = "distribution" | "platforms" | "budget" | "suno";
type ExportWindow = "7d" | "30d" | "all";

const tabs: Array<{ id: ObservabilityTab; label: string }> = [
  { id: "distribution", label: "Distribution" },
  { id: "platforms", label: "Platforms" },
  { id: "budget", label: "Budget" },
  { id: "suno", label: "Suno" }
];

function timestampForFile(now = new Date()): string {
  return now.toISOString().replace(/[:.]/g, "-");
}

function ObservabilityExport() {
  const [windowSize, setWindowSize] = useState<ExportWindow>("7d");
  const [state, setState] = useState<"idle" | "exporting" | "failed">("idle");

  async function exportSnapshot(): Promise<void> {
    setState("exporting");
    try {
      const response = await fetch(`/plugins/artist-runtime/api/status/export?window=${encodeURIComponent(windowSize)}`);
      if (!response.ok) {
        throw new Error(`status export failed: ${response.status}`);
      }
      const blob = new Blob([JSON.stringify(await response.json(), null, 2)], {
        type: "application/json"
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `observability-${windowSize}-${timestampForFile()}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setState("idle");
    } catch {
      setState("failed");
      window.setTimeout(() => setState("idle"), 1500);
    }
  }

  return (
    <div className="observability-export">
      <label>
        <span className="eyebrow">Export window</span>
        <select value={windowSize} onChange={(event) => setWindowSize(event.target.value as ExportWindow)}>
          <option value="7d">7 days</option>
          <option value="30d">30 days</option>
          <option value="all">All history</option>
        </select>
      </label>
      <button type="button" className="primary" disabled={state === "exporting"} onClick={() => void exportSnapshot()}>
        {state === "exporting" ? "Exporting..." : "Export JSON"}
      </button>
      {state === "failed" ? <span className="field-error">export failed</span> : null}
    </div>
  );
}

export function ObservabilityPanel(props: {
  events?: DistributionEvent[];
  eventFilter?: DistributionEventsFilterState;
  onEventFilterChange?: (filter: DistributionEventsFilterState) => void;
  onClearEventFilters?: () => void;
  stats?: Record<SocialPlatform, PlatformStat>;
  platforms?: Partial<Record<SocialPlatform, Pick<PlatformStatus, "authStatus" | "lastTestedAt" | "reason">>>;
  budgetCard: ReactNode;
  sunoCard: ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<ObservabilityTab>("distribution");

  return (
    <article className="panel observability-panel">
      <div className="observability-header">
        <div>
          <div className="section-title">Observability</div>
          <div className="muted">Distribution, platform uptime, budget, and Suno worker state in one operator surface.</div>
        </div>
        <ObservabilityExport />
      </div>
      <div className="observability-tabs" role="tablist" aria-label="Observability tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`tab-button${activeTab === tab.id ? " is-active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="observability-body">
        {activeTab === "distribution" ? (
          <DistributionEventsCard
            events={props.events}
            filter={props.eventFilter}
            onFilterChange={props.onEventFilterChange}
            onClearFilters={props.onClearEventFilters}
          />
        ) : null}
        {activeTab === "platforms" ? <PlatformUptimeCard stats={props.stats} platforms={props.platforms} /> : null}
        {activeTab === "budget" ? props.budgetCard : null}
        {activeTab === "suno" ? props.sunoCard : null}
      </div>
    </article>
  );
}
