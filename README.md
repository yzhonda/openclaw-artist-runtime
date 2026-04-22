# OpenClaw Artist Runtime

OpenClaw Artist Runtime turns an OpenClaw agent into a **public autonomous AI musician**.
It runs on a Mac as an OpenClaw plugin, creates songs from its own artistic state,
generates music with Suno, and shares finished or in-progress work to selected
public platforms such as X, Instagram, and TikTok.

This repository is structured as a **distribution-ready OpenClaw native plugin package**.
It is intended to be published to ClawHub and/or npm after implementation and review.

## Product stance

Artist Runtime is not a private writing assistant. It is a public artist daemon.

The producer chooses:

- which platforms the artist uses;
- how far Suno generation may run autonomously;
- which social post types can be published automatically;
- budgets, cadence, and hard stops;
- how much reporting the producer receives.

## Install shape

After publication, the target install command is:

```bash
openclaw plugins install clawhub:@your-org/openclaw-artist-runtime
```

or, if using npm fallback:

```bash
openclaw plugins install npm:@your-org/openclaw-artist-runtime
```

## Current status

This package now includes a working dry-run runtime with a bundled Producer Console,
repo-local OpenClaw sandbox tooling, persisted-config-aware routes, live-safe route
dispatch under the current OpenClaw Gateway matcher, and CI regression gates on
`main` pushes and pull requests.

- Full-cycle smoke tests cover `planning → prompt_pack → suno_generation →
  take_selection → asset_generation → publishing (dry-run) → completed`, and a
  second rotation into `song-002`, with zero external calls (`spawn` and `fetch`
  are mocked and asserted unused).
- Producer Console exposes a live config editor for `autopilot` and
  `distribution.platforms.*`, ticker status, recent X dry-run results, and a
  dry-run simulate-reply form backed by plugin API routes only.
- Producer Console config editing now covers both platform enablement and
  `distribution.platforms.*.authority`, so X / Instagram / TikTok safety modes
  can be switched live from the bundled UI or the fallback inline shell.
- Producer Console now surfaces Suno worker lifecycle and automation outcomes end
  to end: `currentRunId`, `lastImportedRunId`, `lastCreateOutcome`, and
  `lastImportOutcome` are exposed from `/api/suno/status` and rendered in both
  the bundled React UI and the fallback inline Console.
- All read routes, mutating routes, and `/api/config/update` now resolve config
  through the same persisted runtime-config pattern, so Console behavior is
  consistent when `runtime/config-overrides.json` is present.
- Route dispatch is now hardened against the current OpenClaw Gateway's literal
  `:param` matcher behavior: platform test routes are registered statically and
  the `songs`, `alerts`, `platforms`, and `suno` API families use prefix
  dispatch so the existing URLs still work live.
- Suno worker automation now has a full mock-only skeleton: lifecycle state,
  manual login handoff, create/import driver contracts, connector wiring, and
  persisted outcomes are all in place without executing a real browser or Suno run.
- Social connector skeletons are now aligned across all three platforms:
  X/Bird, Instagram, and TikTok each expose auth probing plus fail-closed
  publish/reply behavior, with Instagram/TikTok staying mock-only and dry-run-safe.
- Repo-local verification includes `scripts/openclaw-local-gateway`,
  `scripts/openclaw-local-http-smoke.sh`, `scripts/openclaw-local-write-smoke.sh`,
  and `scripts/openclaw-local-ticker-observe.sh`.
- The repo now includes a GitHub Actions CI workflow that runs `typecheck`, `test`,
  and `build` on pushes and pull requests to `main`.
- CI regression gates have stayed stable through repeated post-fix runs, including
  the workspace-template tracking correction and the lock-file-free workflow update.
- `workspace-template/artist/*` and `workspace-template/songs/.gitkeep` are tracked,
  so fresh CI/workspace bootstrap runs get the same artist files as local development.
- Real Bird / Instagram / TikTok posting, real Suno browser automation, and real
  platform writes are **not** enabled by default and require explicit operator action.
- `autopilot.dryRun` defaults to `true`; the plugin ships safe-by-default.
- Producer Console uses a bundled React app from `ui/dist/` when available and falls
  back to an inline inspection shell when the bundle is missing or stale.

See `CHANGELOG.md` for the active feature set. For implementation details and
contributor onboarding, start with `AGENTS.md`, then `CODEX_START_HERE.md`, then the
docs in order.

## Key package files

- `openclaw.plugin.json` — manifest, config schema, UI hints, capability declaration.
- `package.json` — npm/ClawHub package metadata and OpenClaw compatibility block.
- `SECURITY.md` — credential, browser profile, external action, and reporting policy.
- `PRIVACY.md` — local data, ledgers, external transmissions, deletion model.
- `CAPABILITIES.md` — exact advertised tools, hooks, services, routes, side effects.
- `PUBLISHING.md` — ClawHub/npm pre-publish checklist.
- `MARKETPLACE.md` — listing copy, disclosure text, and packaging strategy.

## Runtime architecture

```text
OpenClaw Gateway
  └─ Artist Runtime plugin
      ├─ Producer Console HTTP route
      ├─ Autopilot service
      ├─ Suno Browser Worker
      ├─ Social Distribution Worker
      ├─ Tools / Hooks / Authority Guards
      ├─ Prompt Ledger / Audit Log
      └─ Connectors: Bird, Instagram, TikTok
```

## Safety defaults

The package schema includes autonomous defaults because the product is a public
artist daemon, but `autopilot.dryRun` defaults to true. Production release must make
initial setup explicit before external side effects occur.

Hard stops are mandatory:

- login challenge;
- CAPTCHA;
- payment prompt;
- UI mismatch;
- policy uncertainty;
- platform capability failure.

## Suno

Suno integration is designed around a background logged-in browser profile or a manual
copy fallback. It must not use CAPTCHA bypass, credential capture, or non-consensual
voice/artist imitation flows.

Every Suno run must persist the complete prompt lineage before any generation action:

- artist snapshot;
- song brief;
- lyrics and YAML lyrics;
- Style and Exclude;
- sliders;
- Suno payload JSON;
- payload hash;
- run metadata;
- take evaluation;
- social derivative prompts.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
npm run pack:verify
```

`npm run build` builds both the runtime TypeScript output and the Producer Console bundle.
The UI bundle is built from `ui/` and included in package verification.

For a repo-local OpenClaw sandbox install that avoids `~/.openclaw`, see
`docs/15_LOCAL_OPENCLAW_SANDBOX.md`.

For a repo-local Gateway smoke run after install, use:

```bash
scripts/openclaw-local-gateway start
scripts/openclaw-local-http-smoke.sh
scripts/openclaw-local-write-smoke.sh
scripts/openclaw-local-gateway stop
```

Before public distribution, update:

- package scope/name;
- repository URLs;
- author/license metadata;
- compatibility versions;
- OAuth application IDs and documentation;
- marketplace screenshots and demo flow.

## Producer Console bundle

The plugin serves a built Producer Console from `ui/dist/` when present.
If the bundle is missing, the plugin falls back to a minimal inline Console shell for safe inspection-only use.
The bundled Console includes the config editor, platform authority selectors,
ticker/status cards, recent X result surface, Suno outcome cards, and
auto-refresh polling; the fallback Console keeps the same core control tower
actions available for safe operation.

To build just the Console:

```bash
npm run build:ui
```

## Full implementation specification

This distributable package intentionally includes the original detailed engineering specification under `docs/full-spec/`. Do not treat those files as extra noise: they preserve the product decisions needed for Codex/agentic development.

For implementation, start with:

```txt
AGENTS.md
CODEX_START_HERE.md
docs/full-spec/PRODUCT_SPEC.md
docs/full-spec/ARCHITECTURE.md
docs/full-spec/SUNO_SPEC.md
docs/full-spec/SOCIAL_CONNECTORS_SPEC.md
docs/full-spec/PROMPT_LEDGER_SPEC.md
```

For marketplace/publication, start with:

```txt
CAPABILITIES.md
SECURITY.md
PRIVACY.md
MARKETPLACE.md
PUBLISHING.md
```

The package is deliberately larger than a minimal plugin sample because it is meant to preserve enough detail for a coding agent to continue implementation without access to the original conversation.
