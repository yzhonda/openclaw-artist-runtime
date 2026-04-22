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
├── docs/SUNO_BROWSER_DRIVER.md        # operator-facing Suno browser-profile lane guide
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
- `src/services/socialDistributionWorker.ts`
- `src/services/socialPublishing.ts`
- `src/services/sunoBrowserWorker.ts`
- `src/services/sunoPlaywrightDriver.ts`
- `src/services/sunoRuns.ts`
- `src/services/sunoPromptPackFiles.ts`
- `src/services/artistState.ts`

These services now share one runtime-config resolution path and feed the same
Producer Console status surfaces. In practice that means:

- `src/services/runtimeConfig.ts` owns the persisted-config resolver now used by
  read routes, mutating routes, and `/api/config/update`.
- `src/services/socialPublishing.ts` now enforces a two-level social live arm:
  `distribution.liveGoArmed` plus `distribution.platforms.{x,instagram,tiktok}.liveGoArmed`
  must both be `true` before upstream dry-run can release.
- `src/services/sunoBrowserWorker.ts` carries both lifecycle state and mock-only
  create/import automation outcomes for the Suno lane.
- `src/services/sunoPlaywrightDriver.ts` now owns the real Playwright-backed
  login probe, live create submit/polling lane, and the local mp3 import
  downloader under `runtime/suno/<runId>/`.
  It now also returns lightweight import metadata and `.m4a` fallback assets
  through the same worker/status path.
  Live create polling now prefers `/create` generation-card song links before
  falling back to the older `/me` library-diff lane.
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
  read-only links and static metadata only
- the same Suno/status markers mirrored in the fallback inline Console shell

The config editor source now owns both:

- enable/disable toggles for each social platform
- authority-mode payload shaping for `distribution.platforms.{x,instagram,tiktok}.authority`
- global + per-platform live-go arm payload shaping, with TikTok forced back to
  `liveGoArmed: false` in the frozen UI lane
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
installation requirement, and the current Chrome-channel + stealth-plugin login
workaround.

### Repo-local OpenClaw sandbox scripts

- `scripts/openclaw-local-env.sh`
- `scripts/openclaw-local-gateway`
- `scripts/openclaw-local-http-smoke.sh`
- `scripts/openclaw-local-write-smoke.sh`
- `scripts/openclaw-local-ticker-observe.sh`
- `scripts/openclaw-local-install.sh`
- `scripts/openclaw-suno-login.sh`
- `scripts/openclaw-suno-login.mjs`

### CI / regression gate

- `.github/workflows/ci.yml`

### Notable test coverage

- `tests/hooks-heartbeat.test.ts`
- `tests/autopilot-ticker.test.ts`
- `tests/autopilot-full-cycle.test.ts`
- `tests/authority.test.ts`
- `tests/config.test.ts`
- `tests/x-bird-connector.test.ts`
- `tests/instagram-connector.test.ts`
  This suite now fixes the Round 42 Graph skeleton contract: auth missing,
  dry-run stage traversal, and non-dry-run `requires_explicit_live_go`.
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
- `tests/suno-imported-assets-surface.test.ts`
  This suite fixes the Round 48 UI/status seam: imported Suno asset metadata is
  mirrored into `/api/status` and `/api/suno/status`, while the UI helper stays
  on read-only links plus the explicit empty placeholder.
- `tests/suno-playwright-probe.test.ts`
- `tests/suno-worker-lifecycle.test.ts`
- `tests/suno-worker-automation.test.ts`
- `tests/status-ticker.test.ts`
  This suite now also fixes the `/api/status` contract for imported Suno
  `paths[]` / `metadata[]` exposure.
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

`CAPABILITIES.md` and `SECURITY.md` now also carry the connector auth contract
for distribution operators:

- X requires the `bird` CLI plus its authenticated local session store
- Instagram probes `OPENCLAW_INSTAGRAM_AUTH` / `OPENCLAW_INSTAGRAM_ACCESS_TOKEN`
- TikTok probes `OPENCLAW_TIKTOK_AUTH` / `OPENCLAW_TIKTOK_ACCESS_TOKEN`

`docs/CONNECTOR_AUTH.md` now also documents the Instagram Graph API skeleton
route (`/me/accounts -> /media -> /media_publish`), the required scopes, the
global + per-platform `liveGoArmed` guards, and the fact that Round 42-45 still
block live posting with an upstream dry-run hold plus
`requires_explicit_live_go` at the connector edge.

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

Also keep the CI workflow and tracked workspace template files because they now form part of the package's regression discipline and bootstrap contract:

- `.github/workflows/ci.yml`
- `workspace-template/artist/*.md`
- `workspace-template/songs/.gitkeep`

Also keep the route/SDK glue and Suno outcome-bearing UI source together, because
the current package relies on them for live Gateway compatibility and Producer
Console parity:

- `src/pluginApi.ts`
- `src/routes/index.ts`
- `ui/src/App.tsx`
- `ui/src/configEditor.ts`
- `tests/suno-worker-automation.test.ts`
- `tests/prompt-pack-and-registration.test.ts`

Also keep the Suno browser-lane runtime dependencies with the package, because
the login/probe path now depends on them directly:

- `playwright`
- `playwright-extra`
- `puppeteer-extra-plugin-stealth`

Also keep the social connector source and tests together, because the package now
ships one aligned dry-run contract across X, Instagram, and TikTok:

- `src/connectors/social/xBirdConnector.ts`
- `src/connectors/social/instagramConnector.ts`
- `src/connectors/social/tiktokConnector.ts`
- `tests/x-bird-connector.test.ts`
- `tests/instagram-connector.test.ts`
- `tests/tiktok-connector.test.ts`

## What may be slimmed later

After implementation stabilizes, the package can move some implementation-planning docs to a separate `docs/dev/` package or GitHub wiki. Do not remove `AGENTS.md`, `SECURITY.md`, `PRIVACY.md`, `CAPABILITIES.md`, or the prompt ledger specification.

Candidates for later slimming remain local development helpers and duplicated spec layers, but not until the implementation and release workflow are fully stable.

## Distribution stance

The eventual public package should default to a safe setup state, but the product goal is autonomous public artist operation. The user should explicitly enable live autopilot and platform-specific publishing during setup.
