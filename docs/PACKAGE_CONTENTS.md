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

## Important directories

```txt
.
├── AGENTS.md                         # primary agent instructions
├── CODEX_START_HERE.md               # initial implementation plan
├── openclaw.plugin.json              # OpenClaw manifest/config schema surface
├── schemas/config.schema.json         # external config schema copy
├── src/                               # package runtime skeleton
├── ui/                                # Producer Console skeleton
├── workspace-template/                # files created in an artist workspace
├── docs/full-spec/                    # original detailed product/architecture specs
├── docs/codex-detailed-specs/         # same detailed specs retained for compatibility
├── docs/*.md                          # distribution-focused docs
├── reference/original-starter-scaffold/ # earlier scaffold retained as reference
└── templates/                         # install-time templates
```

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

## What may be slimmed later

After implementation stabilizes, the package can move some implementation-planning docs to a separate `docs/dev/` package or GitHub wiki. Do not remove `AGENTS.md`, `SECURITY.md`, `PRIVACY.md`, `CAPABILITIES.md`, or the prompt ledger specification.

## Distribution stance

The eventual public package should default to a safe setup state, but the product goal is autonomous public artist operation. The user should explicitly enable live autopilot and platform-specific publishing during setup.
