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

This package is a detailed implementation scaffold. Codex or another coding agent
should start with `AGENTS.md`, then `CODEX_START_HERE.md`, and then the docs in order.
The TypeScript files are intentionally thin and must be adapted to the current
OpenClaw SDK signatures before release.

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
