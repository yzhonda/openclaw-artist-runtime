import type { PlatformStat, SocialPlatform } from "../../src/types";

const platforms: SocialPlatform[] = ["x", "instagram", "tiktok"];

function formatRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function sparklineBars(counts: number[]): Array<{ value: number; height: number }> {
  const max = Math.max(...counts, 1);
  return counts.map((value) => ({
    value,
    height: Math.max(4, Math.round((value / max) * 28))
  }));
}

export function PlatformUptimeCard(props: { stats?: Record<SocialPlatform, PlatformStat> }) {
  return (
    <article className="panel platform-uptime-card">
      <div className="section-title">Platform Uptime</div>
      <div className="list">
        {platforms.map((platform) => {
          const stat = props.stats?.[platform];
          const frozen = platform === "tiktok";
          const failedReason = frozen ? "account_not_created" : Object.entries(stat?.failedReasons ?? {})[0]?.[0];
          return (
            <div className={`item uptime-row${frozen ? " is-frozen" : ""}`} key={platform}>
              <div className="inline-actions">
                <strong>{platform}</strong>
                <span className={`badge ${frozen ? "badge-frozen" : (stat?.successRate ?? 0) >= 0.8 ? "badge-ok" : "badge-warning"}`}>
                  {frozen ? "account_not_created" : `${formatRate(stat?.successRate ?? 0)} success`}
                </span>
              </div>
              <div className="sparkline" aria-label={`${platform} 7 day publish count`}>
                {sparklineBars(stat?.dailyCounts ?? [0, 0, 0, 0, 0, 0, 0]).map((bar, index) => (
                  <span className="sparkline-bar" key={index} title={`${bar.value}`} style={{ height: `${bar.height}px` }} />
                ))}
              </div>
              <div className="muted">
                7d count {stat?.count7d ?? 0} · accepted {stat?.accepted7d ?? 0}
                {failedReason ? ` · ${failedReason}` : ""}
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}
