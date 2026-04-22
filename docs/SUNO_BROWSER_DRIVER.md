# Suno Browser Driver

This document tracks the operator-facing setup for the dedicated Suno browser
lane.

## Status

Round 38 adds real Playwright probe support plus a manual first-login helper.
The driver can now open Chromium against the dedicated Suno profile and detect
whether the session is already logged in. Create/import remain stubbed, so
credit consumption stays at zero.

## Prerequisites

- Use an existing Suno account that the operator controls.
- Keep the browser session on the operator machine only.
- Expect manual login first; automated probing/generation lands in later rounds.
- The browser lane now uses `playwright-extra` plus
  `puppeteer-extra-plugin-stealth` and launches with `channel: "chrome"` so
  Google OAuth is less likely to flag the session as automation.

## Profile path

- Dedicated local profile path: `.openclaw-browser-profiles/suno/`
- This path is excluded from git and must stay on the operator machine.
- Do not copy the profile into ledgers, package artifacts, screenshots, or logs.

## Dependency install (operator)

Playwright is now a package dependency, but browser binaries are still an
operator-side install step. Run these on the operator machine:

```bash
npm install playwright
npx playwright install chromium
```

The project keeps `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` for CI/package installs,
so Chromium is not fetched automatically.

## First login

Use the manual wrapper once per operator machine or whenever the Suno session
expires:

```bash
scripts/openclaw-suno-login.sh
```

That script opens Chromium with the dedicated persistent profile, navigates to
the Suno create surface, and waits for the operator to finish login manually.
Close the browser window when login is complete.

## Google OAuth bot detection workaround

The current login lane uses the stealth plugin and Chrome channel launch options
to suppress the default Playwright automation markers that Google OAuth was
rejecting. In practice, if the operator can sign into Suno through ordinary
Chrome on the same machine, the Playwright lane should now follow the same
Google OAuth flow instead of failing at the "could not sign you in" screen.

If login still fails:

1. confirm ordinary Chrome can sign into the same Suno account;
2. rerun `scripts/openclaw-suno-login.sh`;
3. after login, verify the profile with `music.suno.driver = "playwright"` and
   the existing Suno status/probe surface.

## Config toggle

Enable the browser lane through runtime config override:

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
- `driver: "playwright"` + `dryRun: true` is the current probe-only / no-credit
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
