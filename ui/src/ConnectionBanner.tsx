import type { ConnectionSnapshot } from "../../src/services/connectionState";

export function ConnectionBanner(props: { connection: ConnectionSnapshot; now: number; timeoutSeconds: number }) {
  const { connection } = props;
  if (connection.state === "connected") {
    return null;
  }

  if (connection.state === "recovered") {
    return (
      <section className="panel recovered-banner">
        <strong>Console connection recovered.</strong>
        <div className="muted">The latest status refresh completed successfully.</div>
      </section>
    );
  }

  if (connection.state === "reconnecting") {
    return (
      <section className="panel reconnecting-banner">
        <strong>Reconnecting to Artist Runtime.</strong>
        <div className="muted">Last error: {connection.lastError ?? "unknown error"}</div>
      </section>
    );
  }

  if (connection.state === "offline") {
    return (
      <section className="panel offline-banner">
        <strong>Console refresh failed.</strong>
        <div className="muted">Fetches time out after {props.timeoutSeconds}s. Last error: {connection.lastError ?? "unknown error"}</div>
      </section>
    );
  }

  return (
    <section className="panel stale-banner">
      <strong>Console data may be stale.</strong>
      <div className="muted">
        Last successful refresh {connection.lastRefreshAt ? `${Math.floor((props.now - connection.lastRefreshAt) / 1000)}s ago` : "has not completed yet"}.
      </div>
    </section>
  );
}
