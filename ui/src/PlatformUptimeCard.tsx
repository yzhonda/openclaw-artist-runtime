import type { PlatformAuthStatus, PlatformStat, SocialPlatform } from "../../src/types";

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

type PlatformAuthDetail = {
  authStatus?: PlatformAuthStatus;
  lastTestedAt?: number;
  reason?: string;
};

function relativeTestedAt(timestamp?: number): string {
  if (!Number.isFinite(timestamp) || !timestamp) {
    return "not tested yet";
  }
  const seconds = Math.min(0, Math.round((timestamp - Date.now()) / 1000));
  const absSeconds = Math.abs(seconds);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (absSeconds < 60) {
    return formatter.format(seconds, "second");
  }
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) {
    return formatter.format(minutes, "minute");
  }
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) {
    return formatter.format(hours, "hour");
  }
  return formatter.format(Math.round(hours / 24), "day");
}

function platformReason(platform: SocialPlatform, auth?: PlatformAuthDetail): string {
  if (platform === "tiktok") {
    return "account_not_created";
  }
  if (auth?.reason) {
    return auth.reason;
  }
  return auth?.authStatus === "tested" ? "connected" : auth?.authStatus ?? "unconfigured";
}

function reasonBadgeClass(reason: string): string {
  switch (reason) {
    case "connected":
      return "badge-ok";
    case "bird_auth_expired":
      return "badge-warning";
    case "bird_probe_failed":
      return "badge-warning";
    case "bird_cli_not_installed":
      return "badge-error";
    case "account_not_created":
      return "badge-frozen";
    default:
      return "badge-held";
  }
}

function reasonTooltip(reason: string): string {
  switch (reason) {
    case "connected":
      return "Bird probe succeeded with the selected local profile.";
    case "bird_auth_expired":
      return "Bird reached X but the local session is expired; re-authenticate the selected Firefox profile.";
    case "bird_probe_failed":
      return "Bird ran but did not return a usable account; inspect the profile, timeout, and CLI output.";
    case "bird_cli_not_installed":
      return "The bird CLI is missing from PATH.";
    case "account_not_created":
      return "This platform is frozen until the operator creates and arms an account.";
    default:
      return "No platform-specific recovery hint is registered for this reason.";
  }
}

export function PlatformUptimeCard(props: { stats?: Record<SocialPlatform, PlatformStat>; platforms?: Partial<Record<SocialPlatform, PlatformAuthDetail>> }) {
  return (
    <article className="panel platform-uptime-card">
      <div className="section-title">Platform Uptime</div>
      <div className="list">
        {platforms.map((platform) => {
          const stat = props.stats?.[platform];
          const auth = props.platforms?.[platform];
          const frozen = platform === "tiktok";
          const failedReason = frozen ? "account_not_created" : Object.entries(stat?.failedReasons ?? {})[0]?.[0];
          const authReason = platformReason(platform, auth);
          const authText = frozen
            ? "Not configured (account pending)"
            : `${auth?.authStatus ?? "unconfigured"} · tested at ${relativeTestedAt(auth?.lastTestedAt)}`;
          return (
            <div className={`item uptime-row${frozen ? " is-frozen" : ""}`} key={platform}>
              <div className="inline-actions">
                <strong>{platform}</strong>
                <span className={`badge ${frozen ? "badge-frozen" : (stat?.successRate ?? 0) >= 0.8 ? "badge-ok" : "badge-warning"}`}>
                  {frozen ? "account_not_created" : `${formatRate(stat?.successRate ?? 0)} success`}
                </span>
                <span className={`badge ${reasonBadgeClass(authReason)}`} title={reasonTooltip(authReason)}>
                  {authReason}
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
              <div className="muted">{authText}</div>
            </div>
          );
        })}
      </div>
    </article>
  );
}
