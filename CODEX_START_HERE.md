# Codex Start Here — Full Distributable

You are implementing a distribution-ready OpenClaw plugin that is also specified deeply enough for autonomous Codex development.

## Mandatory first steps

1. Read `AGENTS.md` completely.
2. Read `SPEC_INDEX.md`.
3. Read the distribution docs in numeric order:
   - `docs/00_PRODUCT_BRIEF.md`
   - `docs/01_ARCHITECTURE.md`
   - `docs/02_DISTRIBUTION_STRATEGY.md`
   - `docs/03_OPENCLAW_NATIVE_RULES.md`
   - `docs/04_PRODUCER_CONSOLE_SPEC.md`
   - `docs/05_AUTOPILOT_SPEC.md`
   - `docs/06_SUNO_WORKER_SPEC.md`
   - `docs/07_SOCIAL_CONNECTORS_SPEC.md`
   - `docs/08_PROMPT_LEDGER_SPEC.md`
   - `docs/09_DATA_MODEL.md`
   - `docs/10_SECURITY_POLICY.md`
   - `docs/11_TESTING_AND_RELEASE.md`
   - `docs/12_SUNOMANUAL_INTEGRATION.md`
   - `docs/13_CONNECTOR_SPLIT_PLAN.md`
4. Read the detailed implementation specs restored from the starter package:
   - `docs/codex-detailed-specs/PRODUCT_SPEC.md`
   - `docs/codex-detailed-specs/ARCHITECTURE.md`
   - `docs/codex-detailed-specs/IMPLEMENTATION_PLAN.md`
   - `docs/codex-detailed-specs/SUNO_SPEC.md`
   - `docs/codex-detailed-specs/SOCIAL_CONNECTORS_SPEC.md`
   - `docs/codex-detailed-specs/PROMPT_LEDGER_SPEC.md`
   - `docs/codex-detailed-specs/SECURITY_AND_POLICY.md`
   - `docs/codex-detailed-specs/ACCEPTANCE_CRITERIA.md`
5. Inspect `openclaw.plugin.json`, `package.json`, `src/**`, `templates/**`, and `workspace-template/**`.

## Then produce a plan

Before editing code, produce a plan that covers:

- Current OpenClaw SDK signatures to verify.
- Which placeholder imports/types need correction.
- First PR scope.
- Build/test commands.
- What remains dry-run.
- How Prompt Ledger is made append-only.
- How Suno Browser Worker avoids credential logging and hard-stop bypasses.
- How SocialAuthority gates X/Instagram/TikTok publishing.
- How package distribution checks remain green.

## First implementation target

Make these pass without any real external side effects:

```bash
npm run typecheck
npm test
npm run pack:verify
npm run pack:dry-run
```

Do not implement real Suno/SNS actions until:

- config schema is passing,
- dry-run blocks external calls,
- authority guards are tested,
- Prompt Ledger is append-only,
- audit logging is implemented.
