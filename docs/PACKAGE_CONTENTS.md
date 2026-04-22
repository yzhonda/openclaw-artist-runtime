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
- `src/services/sunoRuns.ts`
- `src/services/sunoPromptPackFiles.ts`
- `src/services/artistState.ts`

These services now share one runtime-config resolution path and feed the same
Producer Console status surfaces. In practice that means:

- `src/services/runtimeConfig.ts` owns the persisted-config resolver now used by
  read routes, mutating routes, and `/api/config/update`.
- `src/services/sunoBrowserWorker.ts` carries both lifecycle state and mock-only
  create/import automation outcomes for the Suno lane.
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
- ticker and recent X dry-run status
- Suno lifecycle plus create/import outcome cards rendered from `/api/suno/status`
- the same Suno/status markers mirrored in the fallback inline Console shell

The config editor source now owns both:

- enable/disable toggles for each social platform
- authority-mode payload shaping for `distribution.platforms.{x,instagram,tiktok}.authority`

### Repo-local OpenClaw sandbox scripts

- `scripts/openclaw-local-env.sh`
- `scripts/openclaw-local-gateway`
- `scripts/openclaw-local-http-smoke.sh`
- `scripts/openclaw-local-write-smoke.sh`
- `scripts/openclaw-local-ticker-observe.sh`
- `scripts/openclaw-local-install.sh`

### CI / regression gate

- `.github/workflows/ci.yml`

### Notable test coverage

- `tests/hooks-heartbeat.test.ts`
- `tests/autopilot-ticker.test.ts`
- `tests/autopilot-full-cycle.test.ts`
- `tests/x-bird-connector.test.ts`
- `tests/instagram-connector.test.ts`
- `tests/tiktok-connector.test.ts`
- `tests/social-publishing-reply.test.ts`
- `tests/config-update-route.test.ts`
- `tests/config-editor-payload.test.ts`
- `tests/suno-worker-lifecycle.test.ts`
- `tests/suno-worker-automation.test.ts`
- `tests/status-ticker.test.ts`
- `tests/persisted-config-helper-routes.test.ts`
- `tests/mutating-route-config-resolution.test.ts`
- `tests/prompt-pack-and-registration.test.ts`

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

Also keep the built UI bundle and its source provenance together:

- `ui/dist/**`
- `ui/index.html`
- `ui/src/**`
- `ui/vite.config.ts`

That UI source now explicitly includes:

- `ui/src/SunoOutcomeCard.tsx` for the compact Suno status/outcome block
- `ui/src/configEditor.ts` authority-aware config draft / payload shaping
- bundled + fallback parity for Suno dry-run badges and authority selectors

Also keep the repo-local verification scripts because they are the documented safe-install and safe-smoke path for this plugin:

- `scripts/openclaw-local-env.sh`
- `scripts/openclaw-local-gateway`
- `scripts/openclaw-local-http-smoke.sh`
- `scripts/openclaw-local-write-smoke.sh`
- `scripts/openclaw-local-ticker-observe.sh`

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
