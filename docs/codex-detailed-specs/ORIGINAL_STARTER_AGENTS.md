# AGENTS.md — OpenClaw Artist Runtime Starter

## Mission
Build an OpenClaw-native plugin that turns an OpenClaw agent into a **public autonomous musical artist**.

The artist runs on a Mac where the user usually does **not** watch the screen. The plugin must operate like a public artist daemon:

1. Maintain an artist identity and evolving creative state.
2. Autonomously decide song ideas from its interests and observations.
3. Generate lyrics and Suno prompt packs using the bundled Suno Production Pack derived from `sunomanual`.
4. Use Suno to create tracks through a login-persisted browser worker.
5. Save the artwork, generated tracks, all prompts, payloads, run logs, and social outputs.
6. Publish daily sharing assets to selected platforms: X, Instagram, TikTok.
7. Provide a web-based Producer Console for setup, connection, policy, audit, and recovery.

The user should be able to start Codex with: “Read AGENTS.md and make a plan.” This file is therefore the primary implementation guide.

---

## Non-negotiable product assumptions

- This is **not** a private studio helper. It is always a **Public Artist Runtime**.
- Producer Console is not the daily workflow. It is a control tower: setup, settings, audit, pause, recovery.
- Default operating mode after setup should be autonomous enough to create music and share it publicly within configured limits.
- The user chooses which public platforms to enable: X, Instagram, TikTok.
- X uses Bird where available.
- Instagram and TikTok use official platform APIs where possible.
- Suno requires login. The plugin must support a dedicated persistent Suno browser session on the Mac.
- Tampermonkey is not the primary path. Manual copy mode is a fallback only.
- A track is not complete unless all creation prompts and payloads are stored.

---

## OpenClaw-native constraints

Follow OpenClaw design. Avoid unique infrastructure that will break every time OpenClaw changes.

### Do

- Use a native OpenClaw plugin package with `openclaw.plugin.json`.
- Declare user-facing configuration with `configSchema` and `uiHints`.
- Register plugin behavior via `api.registerTool`, `api.registerHook`, `api.registerService`, and `api.registerHttpRoute`.
- Use focused SDK imports such as `openclaw/plugin-sdk/plugin-entry` and `openclaw/plugin-sdk/runtime-store` after verifying current SDK paths.
- Keep side effects behind registered tools.
- Enforce autonomous-public action policy through hooks/guards before side-effecting tools run.
- Use OpenClaw Cron / Heartbeat / Standing Orders / Tasks where appropriate.
- Keep Producer Console thin: call plugin APIs/tools; do not talk directly to Suno, Instagram, TikTok, or Bird from frontend code.
- Persist creative state in workspace files and machine runtime state in plugin runtime store.
- Use append-only ledgers for prompts, Suno runs, social publishing, and audit events.

### Do not

- Do not fork OpenClaw.
- Do not deep-import OpenClaw internals such as `src/*`, bundled extension internals, or private helpers.
- Do not replace the OpenClaw agent loop.
- Do not build a separate daemon unrelated to the OpenClaw Gateway.
- Do not expose platform passwords to the model or store them in plugin config.
- Do not automate CAPTCHA, payment prompts, login challenges, or account lockout recovery.
- Do not use unofficial Suno reverse-engineered APIs as the default connector.
- Do not implement a hidden approval/permission system that bypasses OpenClaw tool/hook behavior.

---

## Read these files first

1. `README.md` — repository overview.
2. `docs/PRODUCT_SPEC.md` — product intent and user flow.
3. `docs/ARCHITECTURE.md` — OpenClaw-native system design.
4. `docs/IMPLEMENTATION_PLAN.md` — implementation phases.
5. `docs/SUNO_SPEC.md` — Suno production, browser worker, and prompt ledger requirements.
6. `docs/SOCIAL_CONNECTORS_SPEC.md` — X/Bird, Instagram, TikTok connectors.
7. `docs/PROMPT_LEDGER_SPEC.md` — exact retention requirements.
8. `docs/SECURITY_AND_POLICY.md` — hard stops and public side-effect boundaries.
9. `plugin/openclaw.plugin.json` — config schema and UI hints.
10. `workspace-template/AGENTS.md` — artist-facing standing orders.

Then make a plan before editing code.

---

## Implementation order

### Phase 0 — Inspect and adapt

- Inspect the current OpenClaw version and plugin SDK API in the target repository.
- Confirm the exact signature for `definePluginEntry`, `registerTool`, `registerHook`, `registerService`, `registerHttpRoute`, runtime store, and config access.
- Update stubs in `plugin/src/**` to current SDK APIs.
- Run TypeScript/lint checks available in the target repo.

### Phase 1 — Plugin skeleton and config

- Make the plugin load in OpenClaw.
- Validate `openclaw.plugin.json`.
- Register no-op tools and Producer Console routes.
- Make config readable from plugin code.
- Add minimal runtime store helpers.

Acceptance:
- OpenClaw discovers and enables `artist-runtime`.
- Producer Console route opens.
- `/api/status` returns config, platform statuses, and worker states.

### Phase 2 — Artist workspace and bootstrap

- Copy `workspace-template/**` or generate equivalent files in the selected artist workspace.
- Implement `bootstrapArtist` hook so the agent receives `ARTIST.md`, `CURRENT_STATE.md`, `SOCIAL_VOICE.md`, Suno profile, and public-autonomy rules.
- Implement `ArtistStateService` for reading/writing state files.

Acceptance:
- A session can answer as the artist, not as a generic assistant.
- Missing workspace files are created safely from templates.

### Phase 3 — Prompt ledger and song repository

- Implement append-only ledgers.
- Implement song directory creation and status state machine.
- Every tool that creates content must call `PromptLedger.append()` before returning.

Acceptance:
- Creating a song idea produces `songs/<song-id>/brief.md` and `prompts/prompt-ledger.jsonl`.
- Ledger entries include stage, timestamp, input refs, prompt text, output refs, config snapshot/hash, artist snapshot/hash.

### Phase 4 — Suno Production Pack

- Import or vendor the user-owned `sunomanual` knowledge into `packages/suno-production/knowledge`.
- Implement `createSunoPromptPack()`.
- Generate Style, Exclude, YAML lyrics, sliders, payload JSON, and validation report.
- Ensure the Suno payload is saved before any Suno browser action.

Acceptance:
- `artist_suno_create_prompt_pack` creates all required files and ledger entries.
- Validation prevents missing Style/Exclude/YAML/payload.

### Phase 5 — Suno Browser Worker

- Implement persistent browser profile for Suno.
- First-run path opens Suno and waits for human login.
- After login, background worker can open create page, fill prompt pack, click Create if policy allows, wait/poll for results, and import generated URLs/take info.
- Stop on login challenge, CAPTCHA, payment prompt, UI mismatch, or repeated failures.

Acceptance:
- With a logged-in Suno profile, a song run can create a generation job without the user watching the screen.
- If any hard stop is detected, the worker pauses and reports an actionable alert.

### Phase 6 — Social connectors

- Implement common `SocialConnector` interface.
- X connector wraps Bird.
- Instagram connector wraps Content Publishing API or equivalent official flow.
- TikTok connector wraps Content Posting API or equivalent official flow.
- Implement capability checks per platform.

Acceptance:
- Each enabled platform reports account, capability, quota/rate status, and last action.
- X can publish via Bird when Bird is configured.
- Instagram/TikTok can at least stage/publish according to capabilities and configured authority.

### Phase 7 — Autopilot

- Implement autonomous cycle service:
  `observe -> ideate -> brief -> lyrics -> Suno prompt pack -> Suno generate -> select take -> create social assets -> publish -> log`.
- Use config limits: monthly Suno budget, daily generation cap, per-platform posting caps, quiet windows, hard stops.
- Schedule with OpenClaw-native cron/heartbeat mechanisms where possible; otherwise isolate scheduling in a registered plugin service and make it inspectable in the Console.

Acceptance:
- On a Mac where the screen is not watched, the artist can create and share daily outputs within policy.
- Dashboard shows current cycle stage and last successful verified action.

### Phase 8 — Producer Console

- Implement web UI pages:
  - Dashboard
  - Platforms
  - Music / Suno
  - Content Pipeline
  - Songs
  - Prompt Ledger
  - Artist Mind
  - Settings
  - Alerts
- Console must call plugin API only.
- Make all dangerous actions explicit, auditable, and reversible where possible.

Acceptance:
- User can select X/Instagram/TikTok, connect accounts, set authority, set budgets/cadence, pause/reconnect, and inspect ledgers.

---

## Default operating policy

After setup, default to:

```json
{
  "artist": { "mode": "public_artist" },
  "music": {
    "engine": "suno",
    "suno": {
      "connectionMode": "background_browser_worker",
      "authority": "auto_create_and_select_take",
      "monthlyGenerationBudget": 50,
      "maxGenerationsPerDay": 4,
      "minMinutesBetweenCreates": 20,
      "promptLogging": "full"
    }
  },
  "distribution": {
    "dailySharing": "auto",
    "officialRelease": "manual_approval"
  },
  "platforms": {
    "x": { "connector": "bird", "authority": "auto_publish" },
    "instagram": { "authority": "auto_publish_visuals" },
    "tiktok": { "authority": "auto_publish_clips" }
  }
}
```

Even in autonomous mode, always stop for:

- login expired
- CAPTCHA or anti-bot challenge
- payment or credit purchase prompt
- UI change / selector mismatch
- platform policy uncertainty
- legal/rights uncertainty
- third-party named imitation or voice cloning risk
- repeated failed publishes

---

## Key design vocabulary

- **Artist Runtime**: OpenClaw-native plugin that manages public artist identity, autonomy, music, social publishing, and audit.
- **Producer Console**: Web control tower for setup/settings/audit/recovery.
- **Suno Browser Worker**: Dedicated persistent Suno browser profile used by the plugin after human login.
- **Prompt Ledger**: Append-only creation history. Mandatory for every work.
- **Daily Sharing**: Routine public sharing of lyrics, demo snippets, creation notes, visual cards, and clips.
- **Official Release**: Separate higher-risk action, initially approval-gated.
- **Hard Stop**: Condition where autonomous execution must pause and alert.

---

## Coding rules

- Prefer small modules with explicit types.
- Make every side-effecting operation idempotent or explicitly non-idempotent with run IDs.
- Never mutate prompt ledgers; append new entries.
- Store human-readable Markdown and machine-readable JSONL side by side.
- Include `reason`, `policyDecision`, `configSnapshot`, and `sourceRefs` for public actions.
- Do not silently fail. Use Execute → Verify → Report.
- Use feature flags and capability checks for external platforms.
- Write tests around policy decisions, ledger append behavior, song state transitions, and connector failure modes.

---

## First Codex plan should include

1. Current OpenClaw SDK/API verification.
2. Any needed corrections to this scaffold.
3. MVP scope for first PR.
4. Build/test commands for the target repo.
5. Risks and assumptions.
6. A step-by-step implementation sequence.

Do not begin broad rewrites before producing that plan.