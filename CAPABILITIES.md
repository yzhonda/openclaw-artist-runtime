# Capabilities

This document is part of the marketplace disclosure. Keep it accurate.

## Tools

- `artist_song_ideate` — create song ideas from artist state.
- `artist_suno_create_prompt_pack` — create Style, Exclude, YAML lyrics, sliders, and payload JSON.
- `artist_suno_generate` — execute Suno generation through the configured connection mode.
- `artist_suno_import_results` — import Suno URLs/take metadata.
- `artist_take_select` — evaluate and select generated takes.
- `artist_social_publish` — publish configured social content.
- `artist_social_reply` — reply to social mentions when allowed.

## Hooks

- `agent:bootstrap` — inject artist state and operating policy.
- `before_tool_call` — enforce MusicAuthority/SocialAuthority.
- `after_tool_call` — append audit events.

## Services

- `artistAutopilotService` — runs production cycles.
- `sunoBrowserWorker` — manages Suno browser profile and generation runs.
- `socialDistributionWorker` — converts selected takes into platform-specific posts.

## HTTP routes

- `/plugins/artist-runtime` — Producer Console.
- `/plugins/artist-runtime/api/*` — setup/status/settings/ledger/recovery APIs.

## External side effects

When enabled and configured, this plugin can:

- operate a logged-in Suno browser profile;
- create Suno generations and consume credits;
- publish to X through Bird;
- publish to Instagram through Meta APIs;
- publish to TikTok through TikTok APIs;
- store local prompt ledgers, audit logs, and creative assets.

## Hard stops

The plugin must stop and surface an alert on:

- login challenge;
- CAPTCHA or bot challenge;
- payment prompt or credit purchase flow;
- missing platform capability;
- quota exhaustion;
- high-risk content classification;
- credential storage/logging attempt;
- UI mismatch in browser automation.
