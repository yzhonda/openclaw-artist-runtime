# Changelog

## [Unreleased]

### Added
- Bird (X) auth probe via `bird whoami --plain` in `XBirdConnector.checkConnection` (3 unit cases).
- Bird (X) text-only publish path via `bird tweet` with text-hash dedupe and min-interval guards (5 unit cases).
- Bird (X) reply code path via `bird reply <targetIdOrUrl>` with `targetId` / `targetUrl` threading (5 unit cases).
- Gateway lifecycle hooks (`gateway_start` / `gateway_stop`) as autopilot scheduling anchor.
- `AutopilotTicker` service for periodic `runCycle` with gating (`enabled`, `paused`, `hardStopReason`, `concurrent`).
- Suno browser worker lifecycle state machine (`connecting` / `connected` / `login_required` / `disconnected` / `stopped`) with manual login handoff skeleton and persistent state.
- `/api/status.ticker` surface exposing `{ lastOutcome, lastTickAt, intervalMs }`.
- `/api/platforms/x/simulate-reply` dry-run-only route for Console reply preview.
- Producer Console UI: bundled React app served from `ui/dist/` with Ticker card, Recent X Result, Simulate Reply form, and 3-second polling.
- `socialPublishing.ts` `SocialActionInput` carries `targetId` / `targetUrl` through to `XBirdConnector.reply()`.
- Autopilot full-cycle dry-run smoke test: `planning → prompt_pack → suno_generation → take_selection → asset_generation → publishing (dry-run) → completed` with external-call-zero assertion.
- `scripts/openclaw-local-gateway` lifecycle helpers (`start` / `stop` / `status` / `tail`) for repo-local OpenClaw sandbox.

### Fixed
- `/api/config/update` accepts `payload.config` as patch fallback.
- UI bundle resolution uses plugin-root path via `import.meta.url` rather than `process.cwd()`, so the bundled Console renders even when the gateway's cwd is `.local/openclaw/home`.
- `stripUiBasePath` helper normalizes `/plugins/artist-runtime/ui/` asset references to `ui/dist/` relative paths during inlining.

### Changed
- `.gitignore` excludes repo-root workspace artifacts (`ARTIST.md` / `HEARTBEAT.md` / `SOUL.md` / `runtime/`) that appear when autopilot runs against the default `workspaceRoot: "."`.

### Security
- Real Bird / Instagram / TikTok posting, real Suno browser automation, and real
  platform writes remain gated behind explicit operator action. The test suite asserts
  `node:child_process.spawn` and `fetch` are not invoked during dry-run cycles.

## 0.1.0

Initial distributable package skeleton.

- OpenClaw-native plugin package root.
- ClawHub/npm publishing metadata.
- Producer Console route scaffold.
- Autopilot/Suno/Social connector architecture.
- Security, privacy, capability, and publishing documentation.
- Append-only Prompt Ledger and audit log specs.
