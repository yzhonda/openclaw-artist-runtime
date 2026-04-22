# Suno Browser Driver

This document tracks the operator-facing setup for the dedicated Suno browser
lane.

## Status

Round 37 is skeleton-only. The `PlaywrightSunoDriver` class exists, but it does
not import Playwright, launch a browser, or contact Suno yet.

## Prerequisites

- Use an existing Suno account that the operator controls.
- Keep the browser session on the operator machine only.
- Expect manual login first; automated probing/generation lands in later rounds.

## Profile path

- Dedicated local profile path: `.openclaw-browser-profiles/suno/`
- This path is excluded from git and must stay on the operator machine.
- Do not copy the profile into ledgers, package artifacts, screenshots, or logs.

## Dependency install (operator)

The plugin package does not add Playwright to `package.json`. When the operator
is ready for the real browser lane in a later round, install it locally in the
operator environment:

```bash
npm install playwright
npx playwright install chromium
```

Until then, keep `music.suno.driver` on `mock`.

## Config toggle

Enable the future browser lane through runtime config override:

```json
{
  "music": {
    "suno": {
      "driver": "playwright"
    }
  }
}
```

Default remains:

```json
{
  "music": {
    "suno": {
      "driver": "mock"
    }
  }
}
```

## Dry-run vs live

`autopilot.dryRun` and `music.suno.driver` are separate controls:

- `driver: "mock"` + `dryRun: true` keeps the current fully stubbed lane
- `driver: "playwright"` + `dryRun: true` is the future probe-only / no-credit
  lane
- `driver: "playwright"` + `dryRun: false` remains out of scope until later
  rounds add explicit GO and budget guards

## Credit budget

Real Suno generation is still blocked in this round, so credit consumption stays
zero. Budget control for live browser automation is planned before real create
flow is enabled.

## Rollback

Set `music.suno.driver` back to `mock` to return immediately to the built-in
dry-run-safe skeleton.

## See also

- `docs/CONNECTOR_AUTH.md`
- `docs/GATEWAY_AUTH.md`
- `SECURITY.md`
- `PRIVACY.md`
