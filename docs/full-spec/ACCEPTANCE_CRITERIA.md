# Acceptance Criteria

## MVP acceptance

- Plugin installs/enables under OpenClaw without core modifications.
- Producer Console is served from plugin HTTP route with Gateway auth.
- Config schema validates user-facing settings.
- Workspace template files are created/read.
- Artist prompt/bootstrap includes public artist identity and standing orders.
- Suno prompt pack generation creates Style, Exclude, YAML lyrics, sliders, payload, validation, and ledger entries.
- Prompt Ledger is append-only and per-song.
- Suno worker supports first-login setup and background use after login.
- Suno worker stops on hard stops.
- X/Bird connector can publish a daily sharing text post in test mode or real mode.
- At least one social publish path writes audit and URL.
- Dashboard shows current status.
- Pause stops autonomous creation and publishing.

## Beta acceptance

- Full unattended cycle works after setup.
- Instagram and TikTok connector capability checks work.
- At least one media asset generation path works for Instagram/TikTok.
- Budget and cadence limits are enforced.
- Alert system handles login expiry and UI mismatch.
- Tests cover policy decisions and ledgers.

## Production acceptance

- Connector credentials handled securely.
- No passwords stored.
- Reliable recovery from partial runs.
- Logs explain every public action.
- Official release remains separate from daily sharing.
- Upgrade checklist passes against new OpenClaw release.