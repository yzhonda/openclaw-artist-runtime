# Source Notes for Implementers

These notes summarize public references that informed the scaffold. Verify them in the target OpenClaw checkout before coding.

## OpenClaw plugin model

- Native plugins run in-process with Gateway and can register tools, network handlers, hooks, and services. Treat them as trusted code.
- Plugins should declare capabilities through the plugin API/registry instead of hidden core paths.
- New plugins should prefer `register` over legacy activation forms.

## OpenClaw plugin build surface

- A plugin can register tools, hooks, HTTP routes, services, providers, and media generation providers.
- Tool names must not clash with core tools.
- Optional tools should be used for side effects or extra binary requirements when appropriate.
- `before_tool_call` can block or require approval; check current hook semantics before implementing.
- Use focused `openclaw/plugin-sdk/<subpath>` imports.

## Config and UI

- `openclaw.plugin.json` should include `configSchema`.
- `uiHints` can provide labels/help/sensitive/advanced metadata.
- Plugin-specific config should be under `plugins.entries.<id>.config`.

## Browser login

- For login-required sites, prefer manual login in the host/OpenClaw browser profile.
- Do not give credentials to the model.
- Automated login can trigger anti-bot defenses.

## Automation

- Cron is for precise schedules and task records.
- Heartbeat is for periodic context-aware checks.
- Standing orders define persistent authority and boundaries.
- Hooks react to lifecycle/tool/message events.

## sunomanual

Expected repo structure contains:

- `skills/suno/SKILL.md`,
- `skills/suno/knowledge/lyric_craft.md`,
- `song_structures.md`,
- `style_catalog.md`,
- `rap_and_flow.md`,
- `english_lyrics.md`,
- `suno_v55_reference.md`,
- `yaml_template.md`,
- existing Tampermonkey autofill script.

Artist Runtime should use this knowledge internally but not require Tampermonkey as the default user path.