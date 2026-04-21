# Implementation Plan

## Milestone 1 — Loadable plugin

Tasks:

- Verify SDK imports.
- Make `plugin/src/index.ts` register routes/tools/hooks.
- Validate `openclaw.plugin.json`.
- Implement `/api/status` returning static status.
- Add smoke test if test framework exists.

Done when:

- OpenClaw lists/enables plugin.
- Console loads.

## Milestone 2 — Workspace and state

Tasks:

- Implement `ArtistStateService`.
- Generate workspace files from `workspace-template`.
- Read `ARTIST.md`, `CURRENT_STATE.md`, `SOCIAL_VOICE.md`.
- Implement bootstrap hook.

Done when:

- Artist context is injected/readable.
- Missing templates are created.

## Milestone 3 — Prompt ledger and song repository

Tasks:

- Implement ID generation.
- Implement append-only JSONL.
- Implement song directory creation.
- Implement status transitions.
- Tests for ledger append and song state.

Done when:

- Creating a brief creates all expected dirs/files.

## Milestone 4 — Suno prompt pack

Tasks:

- Wire `packages/suno-production`.
- Import/copy `sunomanual` knowledge.
- Implement prompt pack generator.
- Implement validators.
- Implement `artist_suno_create_prompt_pack`.

Done when:

- A song has Style/Exclude/YAML/payload/validation saved before any browser action.

## Milestone 5 — Suno Browser Worker

Tasks:

- Implement persistent profile config.
- Connect flow opens Suno login browser.
- Status detects logged-in/accessibility enough for operation.
- Fill form dry-run.
- Create run with budget/hard-stop policy.
- Import result URLs/takes.

Done when:

- The worker can run unattended after first login, or stops safely.

## Milestone 6 — Social publishing

Tasks:

- Implement `SocialConnector` interface.
- Implement X/Bird connector.
- Implement Instagram connector skeleton/capability check.
- Implement TikTok connector skeleton/capability check.
- Implement `SocialAuthority` decisions.
- Implement `artist_social_publish`.

Done when:

- X can publish through Bird.
- Instagram/TikTok show capabilities and can publish/stage in supported mode.

## Milestone 7 — Autopilot

Tasks:

- Implement cycle state machine.
- Add budget/cadence controls.
- Connect Suno generation to distribution.
- Add pause/resume.
- Add alerts.

Done when:

- One full cycle runs from idea to public sharing in a test environment.

## Milestone 8 — Producer Console

Tasks:

- Build UI pages.
- Wire API.
- Add first-run wizard.
- Add ledger viewer.
- Add settings editor.

Done when:

- Non-engineer user can connect services and enable autopilot.

## Milestone 9 — Hardening

Tasks:

- Failure simulation tests.
- Connector mocks.
- Upgrade compatibility notes.
- Security review.
- Documentation.

Done when:

- Hard stops are verified.
- Ledgers are complete.
- No platform credentials leak in logs.