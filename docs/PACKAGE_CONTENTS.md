# Package contents and rationale

This package is intentionally a **full distributable engineering package**, not a compact SDK sample.

It contains both:

1. the files a public OpenClaw plugin package needs for distribution; and
2. the detailed design documents needed for an agentic coding workflow to continue implementation without losing the original product concept.

## Why this package is larger than a normal plugin sample

Artist Runtime is not a simple tool plugin. It includes:

- an autonomous artist runtime;
- a Producer Console;
- Suno background browser worker design;
- X/Instagram/TikTok distribution;
- prompt/payload/run ledgering;
- public action authority guards;
- marketplace/privacy/security docs;
- workspace templates for the artist identity;
- dry-run and live connector separation.

A compact package would be easier to publish, but worse for Codex-driven implementation because the subtle product constraints would be lost. Keep the detailed docs until the implementation is mature.
The package still needs curation: built UI assets belong in the tarball, while local `ui/node_modules/` does not.

## Excluded paths for distribution

These paths must stay out of npm / ClawHub package artifacts and public PR
attachments:

- `.local/`
- `.env` and `.env.*`
- `runtime/`
- `.openclaw-browser-profiles/`
- `.openclaw-browser-profiles/suno/`
- `runtime/suno/*.tmp` and `runtime/suno/**/*.tmp`
- `ui/node_modules/`
- generated package tarballs such as `*.tgz`

The package should contain source, docs, tests, manifest files, and the built UI
bundle. It should not contain operator credentials, browser profiles, local
runtime counters, imported Suno audio, or temporary budget write files.

## Important directories

```txt
.
├── AGENTS.md                         # primary agent instructions
├── CODEX_START_HERE.md               # initial implementation plan
├── openclaw.plugin.json              # OpenClaw manifest/config schema surface
├── schemas/config.schema.json         # external config schema copy
├── src/                               # package runtime skeleton
├── ui/                                # Producer Console source and built bundle
├── scripts/                           # repo-local OpenClaw sandbox + smoke helpers
├── .github/workflows/                 # CI verification workflow
├── tests/                             # runtime, connector, route, and smoke tests
├── workspace-template/                # files created in an artist workspace
├── docs/full-spec/                    # original detailed product/architecture specs
├── docs/codex-detailed-specs/         # same detailed specs retained for compatibility
├── docs/*.md                          # distribution-focused docs
├── docs/API_ROUTES.md                 # plugin HTTP route catalog for Console consumers
├── docs/CONNECTOR_AUTH.md             # operator-facing connector setup / refresh guide
├── docs/ERRORS.md                     # operator-facing reason-code catalog
├── docs/THREAT_MODEL.md               # operator-facing threat model and mitigation map
├── docs/INCIDENT_RESPONSE.md          # operator incident response runbook
├── docs/SUNO_BROWSER_DRIVER.md        # operator-facing Suno browser-profile lane guide
├── docs/PRODUCER_CONSOLE.md           # operator-facing console observability/export guide
├── docs/RUNTIME_CLEANUP.md            # operator-facing runtime retention and cleanup guide
├── reference/original-starter-scaffold/ # earlier scaffold retained as reference
└── templates/                         # install-time templates
```

## Current implementation hotspots

These files are now part of the package because the plugin has moved beyond a thin scaffold.

### Runtime services

- `src/services/autopilotService.ts`
- `src/services/autopilotTicker.ts`
- `src/services/alertAcks.ts`
- `src/services/runtimeConfig.ts`
- `src/config/migrations.ts`
- `src/services/distributionLedgerReader.ts`
- `src/services/socialPublishLedger.ts`
- `src/services/socialDryRunResolver.ts`
- `src/services/socialDistributionWorker.ts`
- `src/services/socialPublishing.ts`
- `src/services/sunoBrowserWorker.ts`
- `src/services/sunoPlaywrightDriver.ts`
- `src/services/sunoProfileLifecycle.ts`
- `src/services/sunoBudget.ts`
- `src/services/sunoRuns.ts`
- `src/services/sunoPromptPackFiles.ts`
- `src/services/artistState.ts`

These services now share one runtime-config resolution path and feed the same
Producer Console status surfaces. In practice that means:

- `src/services/runtimeConfig.ts` owns the persisted-config resolver now used by
  read routes, mutating routes, and `/api/config/update`; it now runs persisted
  overrides through `src/config/migrations.ts` so legacy JSON can be normalized
  before defaults and schema validation apply.
- `src/services/socialPublishing.ts` now enforces a two-level social live arm:
  `distribution.liveGoArmed` plus `distribution.platforms.{x,instagram,tiktok}.liveGoArmed`
  must both be `true` before upstream dry-run can release.
- `src/services/sunoBrowserWorker.ts` carries both lifecycle state and mock-only
  create/import automation outcomes for the Suno lane.
- `src/services/sunoProfileLifecycle.ts` owns the local-only Suno profile stale
  detector, directory snapshot helper, and snapshot pruning helper used for
  operator recovery without changing the live submit path.
- `src/services/sunoPlaywrightDriver.ts` now owns the real Playwright-backed
  login probe, live create submit/polling lane, and the local mp3 import
  downloader under `runtime/suno/<runId>/`.
  It now also returns lightweight import metadata and `.m4a` fallback assets
  through the same worker/status path.
  Live create polling now prefers `/create` generation-card song links before
  falling back to the older `/me` library-diff lane.
- `src/services/sunoBudget.ts` now persists the UTC-day credit counter for live
  Suno submits under `runtime/suno/budget.json` and blocks the create lane with
  `budget_exhausted` before the Playwright submit path can fire.
  It also exposes a read-only `getState()` view so `/api/status` and the
  Producer Console can render the current `consumed / limit / remaining`
  credits without mutating the counter, now falls back to an empty UTC-day
  state when `budget.json` contains invalid JSON, and now replaces the final
  file through a `.tmp` write plus `rename(...)`. The same tracker now exposes
  a manual `reset()` path used by the Producer Console budget reset action.
- `src/services/autopilotTicker.ts` and `src/services/autopilotService.ts` drive
  the cycle/ticker status that the Console polls every 3 seconds.

### Route/SDK glue

- `src/routes/index.ts`
- `src/pluginApi.ts`

These are part of the package surface because the current OpenClaw Gateway treats
`/api/:param` style paths literally. The package now keeps URL compatibility by:

- statically registering platform test routes for `x`, `instagram`, and `tiktok`
- dispatching `songs`, `alerts`, `platforms`, and `suno` under family-level
  prefix routes
- attaching `requestMethod` / `requestPath` metadata in the plugin API bridge
  so route handlers can still parse the original path safely

### Producer Console source

- `ui/index.html`
- `ui/vite.config.ts`
- `ui/src/App.tsx`
- `ui/src/configEditor.ts`
- `ui/src/main.tsx`
- `ui/src/styles.css`

The Console source now includes:

- a live config editor (`ui/src/configEditor.ts`)
- platform authority selectors for X / Instagram / TikTok
- platform probe badges plus rerun controls for X / Instagram
- ticker and recent X dry-run status
- Suno lifecycle plus create/import outcome cards rendered from `/api/suno/status`
- imported asset summaries mirrored from the latest Suno import outcome, with
  copy-path buttons plus static metadata only, without serving `runtime/suno/`
  over HTTP
- a confirmed Suno daily budget reset button that calls the plugin API instead
  of asking the operator to edit `runtime/suno/budget.json` directly
- recent distribution event and platform uptime cards sourced from
  `/api/status.recentDistributionEvents` and `/api/status.platformStats`
- an all-platforms effective dry-run banner sourced from `/api/status.summary`
- the same Suno/status markers mirrored in the fallback inline Console shell

The config editor source now owns both:

- enable/disable toggles for each social platform
- authority-mode payload shaping for `distribution.platforms.{x,instagram,tiktok}.authority`
- global + per-platform live-go arm payload shaping, with TikTok forced back to
  `liveGoArmed: false` in the frozen UI lane
- the Suno daily credit limit payload path under `music.suno.dailyCreditLimit`
- the optional Suno monthly credit limit payload path under
  `music.suno.monthlyCreditLimit`
- the Suno browser-driver selector payload path under `music.suno.driver`

### API route catalog

- `docs/API_ROUTES.md`
- `docs/CONNECTOR_AUTH.md`
- `docs/SUNO_BROWSER_DRIVER.md`

This document exists so plugin consumers do not have to reverse-read
`src/routes/index.ts` just to understand the HTTP surface. It catalogs the
Console shell route plus the `/api/*` read and mutating routes, including the
family-dispatch note required by the current OpenClaw Gateway matcher behavior.

`docs/CONNECTOR_AUTH.md` sits beside it as the operator-focused credential and
refresh guide, with direct links back into the platform test route anchors in
`docs/API_ROUTES.md`.

`docs/SUNO_BROWSER_DRIVER.md` now captures the separate local-browser lane for
Suno, including the dedicated profile path, the operator-managed Playwright
installation requirement, the current Chrome-channel + stealth-plugin login
workaround, and the operator recovery runbook for profile corruption,
reauthentication, migration, budget exhaustion, artifact retention / deletion,
and manual `runtime/suno/budget.json` editing guidance.

### Repo-local OpenClaw sandbox scripts

- `scripts/openclaw-local-env.sh`
  Sources `.local/social-credentials.env` when present and bridges
  `BIRD_FIREFOX_PROFILE` into `OPENCLAW_X_FIREFOX_PROFILE` for the local X/Bird
  probe lane.
- `scripts/openclaw-local-gateway`
- `scripts/openclaw-local-http-smoke.sh`
- `scripts/openclaw-local-write-smoke.sh`
- `scripts/openclaw-local-ticker-observe.sh`
- `scripts/openclaw-local-install.sh`
- `scripts/openclaw-suno-login.sh`
- `scripts/openclaw-suno-login.mjs`
- `scripts/boundary-grep.mjs`
- `scripts/cleanup-runtime.sh`
- `scripts/reset-config.sh`
- `scripts/runtime-disk-usage.sh`
- `scripts/runtime-retention-enforce.sh`
- `scripts/suno-profile-diagnose.sh`
- `scripts/suno-profile-backup.sh`

### CI / regression gate

- `.github/workflows/ci.yml`
- `vitest.config.ts`

CI now runs separate typecheck, coverage test, build, and boundary-grep jobs.
The typecheck/test/build jobs run on Node 20 and 22. `boundary-grep` scans
`src/` and `tests/` for credential-like literals and sensitive console dumps,
while `test:coverage` enforces a 70% line coverage floor through Vitest's v8
coverage provider.
The boundary-grep rule set now includes additional Suno, OAuth, OpenClaw social
token, bearer, cookie, and profile-copy patterns so credential-shaped literals
fail before they reach CI artifacts.

### Notable test coverage

- `tests/hooks-heartbeat.test.ts`
- `tests/autopilot-ticker.test.ts`
- `tests/autopilot-full-cycle.test.ts`
- `tests/authority.test.ts`
- `tests/config.test.ts`
- `tests/x-bird-connector.test.ts`
- `tests/x-connector-dry-run-e2e.test.ts`
- `tests/resolve-reply-target.test.ts`
  This suite locks X reply-target parsing for bare ids, `x.com` /
  `twitter.com` status URLs, missing/invalid targets, and mocked-only `t.co`
  expansion. It also covers the opt-in `OPENCLAW_X_TCO_FETCH_ENABLED=1`
  runtime fetch path and fail-closed non-OK expansion responses.
- `tests/x-connector-reply-audit.test.ts`
  This suite locks the dry-run reply audit metadata written into
  `social-publish.jsonl`, including `t.co` expansion evidence and
  fail-closed `resolutionReason` values, while keeping live replies on
  `requires_explicit_live_go`.
- `tests/instagram-connector.test.ts`
- `tests/instagram-connector-dry-run-e2e.test.ts`
- `tests/instagram-live-rehearsal.test.ts`
  This suite locks the fail-closed Instagram live rehearsal skeleton: no fetch
  without all arms plus explicit GO, mocked account/media staging when armed,
  and no `media_publish` call.
- `tests/platform-auth-status.test.ts`
  This suite locks platform authStatus persistence after probes, TikTok's fixed
  unconfigured state, authStatus schema validation, and Instagram token-expiry
  warning surfacing.
  This suite now fixes the Round 42 Graph skeleton contract: auth missing,
  dry-run stage traversal, and non-dry-run `requires_explicit_live_go`.
- `tests/social-dry-run-resolver.test.ts`
  This suite locks the shared global/platform arm resolution used by
  `socialPublishing`, `socialDistributionWorker`, platform status, and
  `/api/status.summary`.
- `tests/routes/status-distribution-events.test.ts`
  This suite locks the Round 65 recent distribution event surface: empty
  ledgers, 20-row truncation, and TikTok `account_not_created` visibility.
- `tests/routes/status-platform-stats.test.ts`
  This suite locks the Round 65 seven-day platform stats surface: counts,
  success rate, failed reason aggregation, and old-event exclusion.
- `tests/social-publish-ledger-writer.test.ts`
  This suite locks the Round 66 writer boundary: atomic rewrite, stale `.tmp`
  cleanup, 90-day archive rotation, and latest active entry reads.
- `tests/distribution-ledger-reader.test.ts`
  This suite locks archive-aware distribution ledger reads and stats aggregation.
- `tests/config-schema-warnings.test.ts`
  This suite keeps config validation accept-with-warning behavior visible for
  platform arms held by the global live-go flag and disabled platforms with
  positive posting caps.
- `tests/distribution-authority-wiring.test.ts`
  This suite fixes the Round 43 upstream boundary: disabled distribution or a
  disabled Instagram platform toggle must force social publish back into
  dry-run before connector execution, while an armed Instagram path still dies
  at `requires_explicit_live_go`.
  Round 44 extends the same seam with `distribution.liveGoArmed=false`, fixing
  the global social live arm across X / Instagram / TikTok.
  Round 45 adds the per-platform arm seam, proving that global + platform flags
  must both be armed before upstream dry-run can release.
- `tests/tiktok-connector.test.ts`
  This suite now fixes the Round 47 freeze boundary: `checkConnection()` stays
  on `account_not_created` even if TikTok auth env vars are present.
- `tests/platform-probe-badge-wiring.test.ts`
  This suite fixes the Round 47 route/UI seam: X and Instagram probes can be
  rerun through `/api/platforms/{id}/test`, while TikTok stays frozen at
  `account_not_created` even when env vars are set.
- `tests/social-publishing-reply.test.ts`
- `tests/config-update-route.test.ts`
  This suite now also locks the Round 46 TikTok freeze boundary: even if
  `/api/config/update` receives `distribution.platforms.tiktok.liveGoArmed=true`,
  the persisted resolved config is sanitized back to `false`.
- `tests/config-editor-payload.test.ts`
  This suite now covers global/per-platform live-go draft shaping and the
  frozen TikTok arm in the bundled UI payload builder.
- `tests/repository-and-ledger.test.ts`
- `tests/suno-driver-selection.test.ts`
- `tests/suno-playwright-create.test.ts`
  This suite now fixes the two-stage live polling contract: `/create` card
  success, `/me` fallback success, and full timeout.
- `tests/suno-playwright-import.test.ts`
  This suite now locks the cheap import-format boundaries too: extracted
  `.mp3` stays `.mp3`, extracted `.m4a` stays `.m4a`, and 404 downloads fail
  closed with empty imported paths.
- `tests/suno-imported-assets-surface.test.ts`
  This suite fixes the Round 48 UI/status seam: imported Suno asset metadata is
  mirrored into `/api/status` and `/api/suno/status`, while the UI helper stays
  on read-only links plus the explicit empty placeholder.
- `tests/suno-artifact-index.test.ts`
  This suite fixes the Round 78 runtime artifact index: local mp3/m4a files
  under `runtime/suno/<runId>/` are exposed as read-only status evidence with
  run/song linkage and size metadata.
- `tests/suno-budget.test.ts`
  This suite fixes the Round 51 credit gate boundary: reserve success,
  over-limit live submit block before connector.create, UTC-day reset,
  manual reset audit logging, reset-history reads, stale `.tmp` cleanup, and
  monthly-limit blocking.
- `tests/suno-budget-monthly.test.ts`
  This suite isolates the Round 63 monthly credit gate: default `0` remains
  unlimited, while an opted-in monthly cap fails closed without mutating state.
- `tests/status-ticker.test.ts`
  This suite now also locks the Round 52 Suno budget surface: `/api/status`
  returns a read-only `{ date, consumed, limit, remaining, monthly }` budget
  object and stale persisted dates are normalized back to a zero-consumed
  UTC-day view.
- `tests/boundary-grep.test.ts`
  This suite fixes the boundary-grep script itself: forbidden credential
  assignment patterns are detected, clean files pass, and safe env var names do
  not trip the gate. It now also covers the expanded Suno API key, OAuth token,
  OpenClaw social token, legacy TikTok token, and cookie-header leak patterns.
- `tests/config-migrations.test.ts`
  This suite locks the schema-version contract, persisted override migration,
  future-version rejection, mock migration skeleton helpers, and
  `scripts/reset-config.sh` backup/restore behavior.
- `tests/runtime-cleanup-scripts.test.ts`
  This suite backs the operator cleanup scripts: dry-run JSON candidate output,
  runtime disk-usage JSON, and retention-policy candidate listing without
  deleting artifacts.
- `tests/threat-model-validation.test.ts`
  This suite binds the five operator threat-model rows to executable checks:
  Prompt Ledger non-exposure, invalid config override rejection, credential
  non-exfiltration in status, song-scoped artifact paths, and social dry-run
  fail-closed behavior while live-go is unarmed.
- `tests/error-runbook-map.test.ts`
  This suite keeps Producer Console reason-code links aligned with
  `docs/ERRORS.md` headings.
- `tests/suno-playwright-probe.test.ts`
- `tests/suno-worker-lifecycle.test.ts`
- `tests/suno-worker-automation.test.ts`
- `tests/status-ticker.test.ts`
  This suite now also fixes the `/api/status` contract for imported Suno
  `paths[]` / `metadata[]` exposure, profile stale surfacing, reset history,
  runtime artifacts, and per-URL import failures.
  It also locks the social status surface for `liveGoArmed`,
  `platformLiveGoArmed`, and per-platform `effectiveDryRun`.
- `tests/persisted-config-helper-routes.test.ts`
- `tests/mutating-route-config-resolution.test.ts`
- `tests/prompt-pack-and-registration.test.ts`
- `tests/state-and-pipelines.test.ts`

### Workspace template files that must stay tracked

- `workspace-template/AGENTS.md`
- `workspace-template/ARTIST.md`
- `workspace-template/SOUL.md`
- `workspace-template/HEARTBEAT.md`
- `workspace-template/README.md`
- `workspace-template/artist/CURRENT_STATE.md`
- `workspace-template/artist/OBSERVATIONS.md`
- `workspace-template/artist/PRODUCER_NOTES.md`
- `workspace-template/artist/RELEASE_POLICY.md`
- `workspace-template/artist/SOCIAL_VOICE.md`
- `workspace-template/artist/SONGBOOK.md`
- `workspace-template/songs/.gitkeep`

## What should be kept for marketplace publication

Always keep:

- `README.md`
- `SECURITY.md`
- `PRIVACY.md`
- `CAPABILITIES.md`
- `MARKETPLACE.md`
- `PUBLISHING.md`
- `LICENSE`
- `NOTICE.md`
- `openclaw.plugin.json`
- `package.json`
- `config.default.json`

`CAPABILITIES.md` and `SECURITY.md` now also carry the connector auth contract
for distribution operators:

- X requires the `bird` CLI plus its authenticated local session store, with an
  optional `OPENCLAW_X_FIREFOX_PROFILE` override for dedicated artist Firefox
  profiles
- Instagram probes `OPENCLAW_INSTAGRAM_AUTH` / `OPENCLAW_INSTAGRAM_ACCESS_TOKEN`
- TikTok probes `OPENCLAW_TIKTOK_AUTH` / `OPENCLAW_TIKTOK_ACCESS_TOKEN`

`docs/CONNECTOR_AUTH.md` now also documents the Instagram Graph API skeleton
route (`/me/accounts -> /media -> /media_publish`), the required scopes, the
global + per-platform `liveGoArmed` guards, and the fact that Round 42-45 still
block live posting with an upstream dry-run hold plus
`requires_explicit_live_go` at the connector edge.
Its X section also documents dedicated Firefox profile routing, opt-in `t.co`
dry-run expansion, and a probe diagnostics table for Bird CLI / auth / timeout
failure modes.
It also documents the social publish ledger rotation rule:
`social-publish.jsonl` stays active, while entries older than 90 days move to
`social-publish.archive.jsonl` during the next append.
It now also documents X reply-target parsing/audit metadata, persisted
platform `authStatus` / `lastTestedAt` probe evidence, and the fail-closed
Instagram live rehearsal skeleton.

`docs/ERRORS.md` catalogs operator-facing reason codes across social staging,
Suno budget/Playwright failures, and gateway boundary issues. Keep it aligned
whenever connector or budget reason strings change.

`SECURITY.md` and `PRIVACY.md` also document the Suno browser-profile boundary:
`.openclaw-browser-profiles/suno/` stays local-only, and imported audio under
`runtime/suno/<runId>/` remains operator-reviewed local storage by default.

Also keep the built UI bundle and its source provenance together:

- `ui/dist/**`
- `ui/index.html`
- `ui/src/**`
- `ui/vite.config.ts`

That UI source now explicitly includes:

- `ui/src/SunoOutcomeCard.tsx` for the compact Suno status/outcome block
- `ui/src/configEditor.ts` authority-aware config draft / payload shaping
  plus the Round 46 global/per-platform live-go arm controls
- bundled + fallback parity for Suno dry-run badges and authority selectors

Also keep the repo-local verification scripts because they are the documented safe-install and safe-smoke path for this plugin:

- `scripts/openclaw-local-env.sh`
- `scripts/openclaw-local-gateway`
- `scripts/openclaw-local-http-smoke.sh`
- `scripts/openclaw-local-write-smoke.sh`
- `scripts/openclaw-local-ticker-observe.sh`
- `scripts/openclaw-suno-login.sh`
- `scripts/openclaw-suno-login.mjs`
- `scripts/boundary-grep.mjs`
- `scripts/reset-config.sh`
- `scripts/cleanup-runtime.sh`
- `scripts/runtime-disk-usage.sh`
- `scripts/runtime-retention-enforce.sh`
- `scripts/suno-profile-diagnose.sh`
- `scripts/suno-profile-backup.sh`

Also keep the CI workflow and tracked workspace template files because they now form part of the package's regression discipline and bootstrap contract:

- `.github/workflows/ci.yml`
- `workspace-template/artist/*.md`
- `workspace-template/songs/.gitkeep`

Also keep the route/SDK glue and Suno outcome-bearing UI source together, because
the current package relies on them for live Gateway compatibility and Producer
Console parity:

- `src/pluginApi.ts`
- `src/routes/index.ts`
- `src/services/distributionLedgerReader.ts`
- `src/services/sunoProfileLifecycle.ts`
- `ui/src/App.tsx`
- `ui/src/ObservabilityPanel.tsx`
- `ui/src/DistributionEventsCard.tsx`
- `ui/src/PlatformUptimeCard.tsx`
- `ui/src/configEditor.ts`
- `tests/suno-worker-automation.test.ts`
- `tests/suno-profile-lifecycle.test.ts`
- `tests/routes/status-export.test.ts`
- `tests/prompt-pack-and-registration.test.ts`

Also keep the Suno browser-lane runtime dependencies with the package, because
the login/probe path now depends on them directly:

- `playwright`
- `playwright-extra`
- `puppeteer-extra-plugin-stealth`

Also keep the social connector source and tests together, because the package now
ships one aligned dry-run contract across X, Instagram, and TikTok:

- `src/connectors/social/xBirdConnector.ts`
- `src/connectors/social/resolveReplyTarget.ts`
- `src/connectors/social/instagramConnector.ts`
- `src/connectors/social/tiktokConnector.ts`
- `src/services/socialDryRunResolver.ts`
- `tests/x-bird-connector.test.ts`
- `tests/resolve-reply-target.test.ts`
- `tests/x-connector-reply-audit.test.ts`
- `tests/x-connector-dry-run-e2e.test.ts`
- `tests/instagram-connector.test.ts`
- `tests/instagram-connector-dry-run-e2e.test.ts`
- `tests/instagram-live-rehearsal.test.ts`
- `tests/platform-auth-status.test.ts`
- `tests/social-dry-run-resolver.test.ts`
- `tests/tiktok-connector.test.ts`

## What may be slimmed later

After implementation stabilizes, the package can move some implementation-planning docs to a separate `docs/dev/` package or GitHub wiki. Do not remove `AGENTS.md`, `SECURITY.md`, `PRIVACY.md`, `CAPABILITIES.md`, or the prompt ledger specification.

Candidates for later slimming remain local development helpers and duplicated spec layers, but not until the implementation and release workflow are fully stable.

## Distribution stance

The eventual public package should default to a safe setup state, but the product goal is autonomous public artist operation. The user should explicitly enable live autopilot and platform-specific publishing during setup.
