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

### Producer Console source

- `ui/index.html`
- `ui/vite.config.ts`
- `ui/src/App.tsx`
- `ui/src/configEditor.ts`
- `ui/src/main.tsx`
- `ui/src/styles.css`

### Repo-local OpenClaw sandbox scripts

- `scripts/openclaw-local-env.sh`
- `scripts/openclaw-local-gateway`
- `scripts/openclaw-local-http-smoke.sh`
- `scripts/openclaw-local-write-smoke.sh`
- `scripts/openclaw-local-ticker-observe.sh`
- `scripts/openclaw-local-install.sh`

### Notable test coverage

- `tests/hooks-heartbeat.test.ts`
- `tests/autopilot-ticker.test.ts`
- `tests/autopilot-full-cycle.test.ts`
- `tests/x-bird-connector.test.ts`
- `tests/social-publishing-reply.test.ts`
- `tests/config-update-route.test.ts`
- `tests/config-editor-payload.test.ts`
- `tests/suno-worker-lifecycle.test.ts`
- `tests/status-ticker.test.ts`
- `tests/prompt-pack-and-registration.test.ts`

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

Also keep the built UI bundle and its source provenance together:

- `ui/dist/**`
- `ui/index.html`
- `ui/src/**`
- `ui/vite.config.ts`

Also keep the repo-local verification scripts because they are the documented safe-install and safe-smoke path for this plugin:

- `scripts/openclaw-local-env.sh`
- `scripts/openclaw-local-gateway`
- `scripts/openclaw-local-http-smoke.sh`
- `scripts/openclaw-local-write-smoke.sh`
- `scripts/openclaw-local-ticker-observe.sh`

## What may be slimmed later

After implementation stabilizes, the package can move some implementation-planning docs to a separate `docs/dev/` package or GitHub wiki. Do not remove `AGENTS.md`, `SECURITY.md`, `PRIVACY.md`, `CAPABILITIES.md`, or the prompt ledger specification.

Candidates for later slimming remain local development helpers and duplicated spec layers, but not until the implementation and release workflow are fully stable.

## Distribution stance

The eventual public package should default to a safe setup state, but the product goal is autonomous public artist operation. The user should explicitly enable live autopilot and platform-specific publishing during setup.
