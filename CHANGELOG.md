# Changelog

## [Unreleased]

## 0.2.0 - 2026-04-22

### Added
- Producer Console live config editor for `autopilot` and `distribution.platforms.*` via `/api/config/update` (`a3f5a93`).
- `ui/src/configEditor.ts` pure payload builder / validator and dirty-state guard for in-flight edits (`a3f5a93`).
- `scripts/openclaw-local-ticker-observe.sh` for repo-local ticker observation via manual `run-cycle` proxy (`e72e8b5`).
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
- Two-cycle autopilot dry-run smoke test that rotates from `song-001` to `song-002` after dry-run publish completion (`d614813`).
- `scripts/openclaw-local-gateway` lifecycle helpers (`start` / `stop` / `status` / `tail`) for repo-local OpenClaw sandbox.
- GitHub Actions CI workflow for `push` / `pull_request` to `main` running `typecheck`, `test`, and `build` (`bd2156f`).
- `workspace-template/artist/{CURRENT_STATE,OBSERVATIONS,PRODUCER_NOTES,RELEASE_POLICY,SOCIAL_VOICE,SONGBOOK}.md` and `workspace-template/songs/.gitkeep` are tracked to keep CI/workspace bootstrap aligned (`68f885f`).
- Suno worker create/import automation skeleton with mockable driver contracts, persistent `currentRunId` / `lastImportedRunId`, and `generating` / `importing` states (`462c3a0`).
- `/api/suno/status` now exposes `currentRunId`, `lastImportedRunId`, `lastCreateOutcome`, and `lastImportOutcome`, and the BrowserWorker connector routes create/import through worker methods (`acd9d70`).
- Producer Console Suno cards in both the bundled React UI and the fallback inline shell now render `Suno Current Run`, `Last Imported`, `Last Create`, and `Last Import` (`f368898`).

### Fixed
- `/api/config/update` accepts `payload.config` as patch fallback.
- `/api/status` now reflects persisted runtime config overrides and `/api/run-cycle` updates ticker getters (`717219d`).
- Eleven helper-backed read routes now resolve persisted runtime config overrides instead of using defaults only (`e3b02f0`).
- `resolveRuntimeConfig()` is promoted to `src/services/runtimeConfig.ts` and reused across 14 mutating routes (`087acdf`).
- `/api/config/update` now resolves its context through the shared runtime-config resolver as well (`aaf75f4`).
- UI bundle resolution uses plugin-root path via `import.meta.url` rather than `process.cwd()`, so the bundled Console renders even when the gateway's cwd is `.local/openclaw/home`.
- `stripUiBasePath` helper normalizes `/plugins/artist-runtime/ui/` asset references to `ui/dist/` relative paths during inlining.
- GitHub Actions CI no longer requires a lock file; the workflow uses `npm install --no-audit --no-fund` without `cache: npm` (`5cad215`).
- `POST /api/platforms/:id/test` no longer 404s under the current OpenClaw Gateway matcher; platform test routes are registered as static exact paths for `x`, `instagram`, and `tiktok` (`dfadbca`).
- Dynamic API routes no longer depend on literal `:param` matching in the gateway. `songs`, `alerts`, `platforms`, and `suno` now dispatch through family-level prefix routes with request-path metadata injected by `pluginApi.ts` (`ebba4ea`).

### Changed
- `.gitignore` excludes repo-root workspace artifacts with root-only patterns so `workspace-template/artist/*` and `workspace-template/songs/.gitkeep` remain tracked (`68f885f`).
- `docs/PACKAGE_CONTENTS.md` was refreshed for the repo-local ticker observer and expanded runtime/test surface (`e72e8b5`).
- README, package contents, and Console-facing docs are now synchronized through the completed Producer Console Suno UX and live route-dispatch behavior (`c356634`, `f368898`).

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
