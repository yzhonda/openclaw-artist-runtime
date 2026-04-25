# Changelog

## [Unreleased]

### Added
- Marketplace listing docs now summarize connector credential requirements and include a first-pass credential refresh troubleshooting section for X/Bird, Instagram, and TikTok.
- Added `docs/CONNECTOR_AUTH.md` as the dedicated connector setup / refresh guide and linked operator-facing docs back to it.
- Added `docs/GATEWAY_AUTH.md` to document the current plugin-level gateway auth boundary for the HTTP route surface.
- Added a dependency-free `PlaywrightSunoDriver` skeleton and `docs/SUNO_BROWSER_DRIVER.md` for the future operator-managed Suno browser lane.
- Added real Playwright probe wiring plus `scripts/openclaw-suno-login.sh` / `scripts/openclaw-suno-login.mjs` for the manual first-login lane.
- Added `playwright-extra` and `puppeteer-extra-plugin-stealth` so the Suno login lane can ride the Chrome/stealth path documented for operators.
- Added Round 39 Playwright create-form fill support plus `music.suno.submitMode`, keeping the Create button blocked while the Suno lane stays credit-safe.
- Added Round 40 live submit polling so the Playwright Suno lane can click `Create` and wait for new library song URLs when `music.suno.submitMode = "live"`.
- Added Round 41 audio import/download so finished Suno song URLs can be revisited and saved under `runtime/suno/<runId>/` as local mp3 artifacts.
- Added Round 41.1 import metadata/status surfacing so saved Suno assets now carry `format`, optional `title`, and optional `durationSec`, with `/api/status` exposing the imported paths/metadata.
- Added Round 41.2 two-stage live submit polling so `/create` generation cards are checked before the older library-diff fallback.
- Added Round 42 Instagram Graph API skeleton wiring so the connector can model `accounts -> media -> media_publish` while staying dry-run fixed.
- Added Round 43 distribution-authority wiring tests so disabled distribution/platform states are proven to force social publishes back into dry-run before connector execution.
- Added Round 44 `distribution.liveGoArmed` plus `/api/status` dry-run surfacing so the producer can see the global social live arm and each platform's effective dry-run state.
- Added Round 45 per-platform `distribution.platforms.{x,instagram,tiktok}.liveGoArmed` flags so each social lane now needs both the global arm and its own platform arm before upstream dry-run can release.
- Added Round 46 Producer Console live-go toggles for the global arm plus X / Instagram platform arms, while keeping TikTok visibly frozen in the UI.
- Added Round 47 Producer Console probe badges plus rerun controls for X / Instagram, while keeping TikTok visually frozen and probe-disabled.
- Added Round 48 Producer Console imported-asset surfacing for the latest Suno import, showing read-only links plus static metadata without introducing playback UI.
- Added Round 49 cheap boundary tests for Suno import format handling, locking `.mp3`, `.m4a`, and 404-empty outcomes without touching the driver.
- Added Round 50 local-only credential notes for the Suno browser profile and imported Suno artifacts in `SECURITY.md` / `PRIVACY.md`.
- Added Round 51 Suno daily credit budgeting so live Create attempts fail closed with `budget_exhausted` once the UTC-day counter reaches the configured limit.
- Added Round 52 Suno budget surfacing so `/api/status` and the Producer Console now show the UTC-day credit date, consumed amount, limit, and remaining credits.
- Added Round 53 Suno browser recovery runbook docs so operators now have explicit profile-corruption, Google OAuth reauth, migration, and `budget_exhausted` recovery flows.
- Added Round 54 Suno artifact retention/deletion docs so operator-local mp3/m4a handling, manual review, and non-automatic cleanup are now explicit.
- Added Round 55 imported-asset path copy buttons in Producer Console so operators can copy absolute mp3/m4a paths without serving the runtime directory over HTTP.
- Added Round 56 `budget.json` editing guidance so operators now have explicit docs for the Suno credit counter shape, fallback behavior, and safe manual reset flow.
- Added Round 57 invalid-JSON recovery for `runtime/suno/budget.json`, so the budget tracker now falls back to an empty UTC-day state instead of crashing on parse failure.
- Added Round 58 atomic `budget.json` writes, so the Suno budget tracker now writes through a temp file plus `rename(...)` before replacing the final counter file.
- Added Round 59 Producer Console editing for `music.suno.dailyCreditLimit`, so the Suno daily credit ceiling can now be raised or lowered through the existing config patch flow.
- Added Round 60 a confirmed Producer Console reset action for the Suno daily budget counter, backed by `POST /api/suno/budget/reset`.
- Added Round 61 operator security docs for threat modeling, incident response, token expiry, audit redaction, package exclusions, profile recovery, and gateway token-mismatch troubleshooting.
- Added Round 62 CI hardening with boundary-grep, Vitest v8 coverage gating, Node 20/22 matrix jobs, and timeout configuration.
- Added Round 63 Suno runtime resilience with stale budget tmp cleanup, reset audit logging, optional monthly credit limits, classified Playwright create errors, and an operator-confirmed runtime cleanup script.
- Added Round 64 social dry-run E2E hardening with shared effective-dry-run resolution, X/Instagram staging tests, status summaries, config warnings, and `docs/ERRORS.md`.
- Added Round 65 Producer Console observability with recent distribution events, platform 7-day stats, all-platforms dry-run banner, stronger TikTok frozen styling, and budget reset/rollover details.
- Added Round 67 Suno browser-profile lifecycle helpers for stale detection, daily local snapshots, and operator diagnose/backup scripts.
- Added Round 68 Producer Console observability panel tabs plus `/api/status/export` JSON snapshots for 7-day, 30-day, and all-history operator exports.
- Added Round 66 atomic social publish ledger writes with 90-day archive rotation and archive-aware reader coverage.
- Added Mega-A backend/test hygiene: config schema migrations, runtime cleanup scripts/docs, threat-model validation tests, expanded boundary-grep patterns, and Producer Console reason-code runbook links.
- Added Mega-B social-lane polish: X reply-target parsing/audit metadata, platform authStatus/tested-at persistence, Instagram token-expiry status, and a fail-closed Instagram live rehearsal skeleton.
- Added Round 76 X/Bird Firefox profile wiring so `OPENCLAW_X_FIREFOX_PROFILE` can direct runtime probes and dry-run Bird calls at a dedicated artist Firefox profile.
- Added Round 77 X/Bird lane polish with opt-in `t.co` dry-run expansion, normalized reply-target ledger metadata, probe reason badges, and an X probe diagnostics guide.

### Fixed
- Bumped Bird probe timeout from 750ms to 3000ms so Firefox-profile-backed `bird whoami --plain` calls finish within the probe budget.

### Notes
- Operator decision (2026-04-25): the Instagram lane is dropped at parity with TikTok. The Graph API skeleton, live rehearsal gates, and existing tests stay as feature carry-over, but no token will be provisioned, no probe is exercised, and no live publish path will be opened without an explicit operator GO.

### Changed
- Connected `docs/CONNECTOR_AUTH.md` refresh steps directly to platform test route anchors in `docs/API_ROUTES.md` and refreshed package-contents docs for the post-0.3.0 doc/test surface.
- Suno worker selection now accepts `music.suno.driver`, defaulting to `mock` while reserving `playwright` for later operator-installed browser automation.
- Added the `playwright` runtime dependency and documented the operator-side Chromium install boundary without enabling real create/import yet.
- The Playwright Suno lane now fills lyrics/style/instrumental fields on `/create` and returns `submit_skipped` until Round 40 unlocks real submission.
- The Playwright Suno lane now snapshots existing library URLs, submits live generations only in `submitMode = "live"`, and fails closed with `playwright_live_timeout` when no new song URLs arrive.
- The Playwright Suno lane now turns returned `/song/<uuid>` URLs into local mp3 files and reports partial-import failures without discarding successful downloads.
- The Playwright Suno import lane now falls back to `.m4a` when `.mp3` is unavailable and mirrors saved paths plus lightweight metadata into the worker status surface.
- The Playwright live create lane now reports whether success came from `/create` card polling or the `/me` library-diff fallback, while keeping the library path as the final safety net.
- The Instagram connector now resolves dry-run Graph API stages but still rejects all non-dry-run publish attempts with `requires_explicit_live_go`.
- `publishSocialAction()` now forces an upstream dry-run hold whenever distribution is disabled or the target platform toggle is off, leaving Instagram live requests to fail closed with `requires_explicit_live_go` only when the upper pipeline is actually armed.
- `publishSocialAction()` now also forces social publish back into dry-run whenever `distribution.liveGoArmed` is false, and `distributionWorker` mirrors `liveGoArmed` plus per-platform `effectiveDryRun` into `/api/status`.
- `publishSocialAction()` now also holds the social lane in dry-run whenever the target platform arm is off, and `/api/status` mirrors `platformLiveGoArmed` alongside each platform's `effectiveDryRun`.
- Producer Console config payloads now carry global/per-platform live-go arms through the existing `/api/config/update` flow, with TikTok forced back to `liveGoArmed=false` at persistence time.
- TikTok connector health now reports `account_not_created` regardless of env state, and the UI short-circuits all TikTok probe fetch paths before they can fire.

### Fixed
- Suno Google OAuth login now uses the stealth-plugin + Chrome-channel probe/login lane instead of the default automation markers that were getting blocked.

## 0.3.0 - 2026-04-22

### Added
- Producer Console config editing now includes `distribution.platforms.x.authority`, `distribution.platforms.instagram.authority`, and `distribution.platforms.tiktok.authority` selectors in both the bundled React UI and the fallback inline shell (`5836e96`).
- Instagram and TikTok connectors now match the X/Bird dry-run contract with env-based auth probes plus fail-closed publish/reply skeletons (`d4a3a3b`).
- Producer Console Suno outcome rendering now flows through a dedicated `SunoOutcomeCard` component, and both the bundled UI and fallback Console show `Dry-run` badges on mock create/import outcomes (`4965dc9`).

### Changed
- README / package contents were refreshed for the post-0.2.0 authority-editor and three-platform connector parity state (`3831a99`).

### Security
- Connector auth contracts are now explicitly documented for X/Bird, Instagram, and TikTok so operator env/CLI requirements are visible before live distribution is enabled (`c5f2ef3`).

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
