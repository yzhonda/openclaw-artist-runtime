# SPEC_INDEX.md — Read order and package layers

This package is intentionally both:

1. a **distribution-ready OpenClaw plugin package**, and
2. a **Codex implementation workbench** with detailed product, architecture, and acceptance specs.

The previous compact distributable package was too thin for a “read AGENTS.md and build” Codex workflow. This full package restores the detailed starter specs while keeping ClawHub/npm-facing metadata.

## Read order for Codex

1. `AGENTS.md`
2. `CODEX_START_HERE.md`
3. `docs/full-spec/README.md`
4. `docs/00_PRODUCT_BRIEF.md` through `docs/13_CONNECTOR_SPLIT_PLAN.md`
5. `docs/full-spec/PRODUCT_SPEC.md`
6. `docs/full-spec/ARCHITECTURE.md`
7. `docs/full-spec/IMPLEMENTATION_PLAN.md`
8. `docs/full-spec/SUNO_SPEC.md`
9. `docs/full-spec/SOCIAL_CONNECTORS_SPEC.md`
10. `docs/full-spec/PROMPT_LEDGER_SPEC.md`
11. `workspace-template/AGENTS.md`
12. `openclaw.plugin.json`
13. `src/**`
14. `docs/reference-scaffold/**` only when useful as prior scaffold reference.

## Package layers

```text
package root
  ClawHub/npm package metadata and runtime source

docs/
  Distribution-focused public docs

docs/full-spec/
  Full implementation specs from the starter package, retained for Codex planning

workspace-template/
  Artist workspace files generated or copied by the plugin

docs/reference-scaffold/
  Previous plugin scaffold kept as implementation reference only
```

## Publication note

For early development, publish the full package or keep it private while Codex builds. Later, once implementation stabilizes, the public npm/ClawHub package can omit `docs/reference-scaffold/` if desired, but do not remove `AGENTS.md`, `CODEX_START_HERE.md`, or the core full specs until the implementation is mature.
