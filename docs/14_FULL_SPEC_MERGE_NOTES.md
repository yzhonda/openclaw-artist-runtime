# Full Spec Merge Notes

This version intentionally restores the larger, detailed implementation material from the first starter package while keeping the distribution-ready package layout.

## Why this exists

The compact distributable package was appropriate as a public package skeleton, but not ideal for an instruction like:

> Read AGENTS.md and make a plan.

Codex benefits from explicit product assumptions, phases, acceptance criteria, and detailed Suno/social/ledger specs. Those are now included under `docs/codex-detailed-specs/` and referenced from `AGENTS.md`.

## What changed from compact distributable

Added:

- `SPEC_INDEX.md`
- expanded `AGENTS.md`
- expanded `CODEX_START_HERE.md`
- `docs/codex-detailed-specs/*`
- `workspace-template/*`
- `reference/original-starter-scaffold/*`
- `TASKS.md` when available

Kept:

- distribution package root
- `package.json`
- `openclaw.plugin.json`
- marketplace docs
- security/privacy/capability docs
- current `src/**` scaffold
- `ui/**` scaffold
- package verification scripts

## Publication guidance

For a source repository, keep all full specs. For an npm/ClawHub artifact, use `package.json.files` to include only files needed at runtime and public documentation. Do not publish `reference/` unless useful for developers.
