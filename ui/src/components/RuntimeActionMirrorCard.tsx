import React from "react";

export type RuntimeActionMirrorEvent =
  | {
    type: "distribution_change_detected";
    songId: string;
    platform: "unitedMasters" | "spotify" | "appleMusic";
    url: string;
    proposalId?: string;
    timestamp: number;
  }
  | {
    type: "song_take_completed";
    songId: string;
    selectedTakeId?: string;
    urls?: string[];
    timestamp: number;
  };

export interface RuntimeActionMirrorCardProps {
  events?: unknown[];
  busy: boolean;
  mode?: "all" | "distribution" | "song";
  onDistributionApply: (proposalId: string) => Promise<void> | void;
  onDistributionSkip: (proposalId: string) => Promise<void> | void;
  onSongbookWrite: (songId: string) => Promise<void> | void;
  onSongbookSkip: (songId: string) => Promise<void> | void;
}

export function supportedRuntimeActionEvents(events?: unknown[], mode: RuntimeActionMirrorCardProps["mode"] = "all"): RuntimeActionMirrorEvent[] {
  return (events ?? [])
    .filter((event): event is RuntimeActionMirrorEvent => {
      if (typeof event !== "object" || event === null) {
        return false;
      }
      const type = (event as { type?: unknown }).type;
      return type === "distribution_change_detected" || type === "song_take_completed";
    })
    .filter((event) => mode === "all" || (mode === "distribution" ? event.type === "distribution_change_detected" : event.type === "song_take_completed"))
    .slice(0, 5);
}

export async function submitDistributionMirrorAction(
  action: "apply" | "skip",
  proposalId: string | undefined,
  handlers: Pick<RuntimeActionMirrorCardProps, "onDistributionApply" | "onDistributionSkip">
): Promise<void> {
  if (!proposalId) {
    return;
  }
  await (action === "apply" ? handlers.onDistributionApply(proposalId) : handlers.onDistributionSkip(proposalId));
}

export async function submitSongMirrorAction(
  action: "write" | "skip",
  songId: string,
  handlers: Pick<RuntimeActionMirrorCardProps, "onSongbookWrite" | "onSongbookSkip">
): Promise<void> {
  await (action === "write" ? handlers.onSongbookWrite(songId) : handlers.onSongbookSkip(songId));
}

function timeLabel(value: number): string {
  return new Date(value).toLocaleString();
}

export function RuntimeActionMirrorCard(props: RuntimeActionMirrorCardProps) {
  const events = supportedRuntimeActionEvents(props.events, props.mode);
  return (
    <article className="panel runtime-action-mirror-card">
      <div className="section-title">Callback Action Mirror</div>
      {events.length === 0 ? (
        <div className="item muted">No pending distribution or song completion actions.</div>
      ) : (
        <div className="list">
          {events.map((event, index) => {
            if (event.type === "distribution_change_detected") {
              return (
                <div className="item" key={`${event.type}-${event.proposalId ?? event.songId}-${index}`}>
                  <div className="eyebrow">Distribution URL</div>
                  <strong>{event.platform} · {event.songId}</strong>
                  <div className="muted">{timeLabel(event.timestamp)} · {event.url}</div>
                  <div className="inline-actions">
                    <button className="primary" disabled={props.busy || !event.proposalId} onClick={() => void submitDistributionMirrorAction("apply", event.proposalId, props)}>Reflect URL</button>
                    <button disabled={props.busy || !event.proposalId} onClick={() => void submitDistributionMirrorAction("skip", event.proposalId, props)}>Later</button>
                  </div>
                </div>
              );
            }
            return (
              <div className="item" key={`${event.type}-${event.songId}-${index}`}>
                <div className="eyebrow">Song Completion</div>
                <strong>{event.songId}{event.selectedTakeId ? ` · ${event.selectedTakeId}` : ""}</strong>
                <div className="muted">{timeLabel(event.timestamp)} · {(event.urls ?? []).slice(0, 2).join(" · ") || "no URL recorded"}</div>
                <div className="inline-actions">
                  <button className="primary" disabled={props.busy} onClick={() => void submitSongMirrorAction("write", event.songId, props)}>SONGBOOK 反映</button>
                  <button disabled={props.busy} onClick={() => void submitSongMirrorAction("skip", event.songId, props)}>後で</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="muted">Real publish buttons are intentionally absent.</div>
    </article>
  );
}
