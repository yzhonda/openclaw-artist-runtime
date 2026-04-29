import React from "react";

export interface BudgetRateStatusStripProps {
  suno?: {
    used?: number;
    consumed?: number;
    limit: number;
    remaining: number;
  };
  bird?: {
    todayCalls: number;
    dailyMax: number;
    minIntervalMinutes: number;
    cooldownUntil?: string;
    cooldownReason?: string;
    nextAllowedAt?: string;
  };
  distribution?: {
    unitedMasters?: { url: string; detectedAt: string };
    spotify?: { url: string; detectedAt: string };
    appleMusic?: { url: string; detectedAt: string };
  };
}

function timeLabel(value?: string): string {
  if (!value) {
    return "";
  }
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function BudgetRateStatusStrip(props: BudgetRateStatusStripProps) {
  const used = props.suno?.used ?? props.suno?.consumed ?? 0;
  const limit = props.suno?.limit ?? 0;
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const bird = props.bird;
  const birdText = bird?.cooldownUntil
    ? `Cooling down until ${timeLabel(bird.cooldownUntil)}`
    : bird?.nextAllowedAt
      ? `Today ${bird.todayCalls}/${bird.dailyMax}, next at ${timeLabel(bird.nextAllowedAt)}`
      : bird
        ? `Today ${bird.todayCalls}/${bird.dailyMax}, ready`
        : "loading";
  const distribution = props.distribution ?? {};

  return (
    <article className="panel budget-rate-strip">
      <div className="strip-section">
        <div className="eyebrow">Suno</div>
        <strong>Today {used}/{limit || "-"}</strong>
        <div className="budget-progress" aria-label="Suno daily budget">
          <div className="budget-progress-bar budget-progress-ok" style={{ width: `${percent}%` }} />
        </div>
        <div className="muted">{props.suno ? `${props.suno.remaining} remaining` : "loading budget"}</div>
      </div>
      <div className="strip-section">
        <div className="eyebrow">Bird / X</div>
        <strong>{birdText}</strong>
        <div className="muted">{bird?.cooldownReason ?? `${bird?.minIntervalMinutes ?? 60} min interval guard`}</div>
      </div>
      <div className="strip-section">
        <div className="eyebrow">Distribution Detection</div>
        <div className="pill-row">
          <span className="pill">UnitedMasters {distribution.unitedMasters ? "✓" : "-"}</span>
          <span className="pill">Spotify {distribution.spotify ? "✓" : "-"}</span>
          <span className="pill">Apple Music {distribution.appleMusic ? "✓" : "-"}</span>
        </div>
      </div>
    </article>
  );
}
