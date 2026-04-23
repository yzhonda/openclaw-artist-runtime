# Suno Browser Driver

This document tracks the operator-facing setup for the dedicated Suno browser
lane.

## Status

Round 41 keeps the real Playwright probe plus manual first-login helper, allows
`submitMode: "live"` to click `Create`, polls the Suno library for new song
URLs, and can now import finished runs by downloading mp3 assets into the local
workspace. `submitMode: "skip"` still fills the form without submission for
credit-safe rehearsals.

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

To control create behavior separately:

```json
{
  "music": {
    "suno": {
      "submitMode": "skip"
    }
  }
}
```

`submitMode: "skip"` is the default and fills the Suno form without clicking
`Create`. `submitMode: "live"` is now the operator-approved path that clicks
`Create` and waits for new Suno song URLs to appear first on `/create`, then in
the library if the card view stays silent.

## Dry-run vs live

`autopilot.dryRun` and `music.suno.driver` are separate controls:

- `driver: "mock"` + `dryRun: true` keeps the current fully stubbed lane
- `driver: "playwright"` + `dryRun: true` is the current probe-only / no-credit
  lane
- `driver: "playwright"` + `submitMode: "skip"` fills lyrics/style/instrumental
  fields on `/create` but still never clicks the `Create` button
- `driver: "playwright"` + `submitMode: "live"` clicks `Create` and polls
  `https://suno.com/me` until new song URLs appear or the timeout is hit

## Round 40 live submit

The live create lane now performs the following:

1. snapshots the current song URLs from `https://suno.com/me`;
2. opens `https://suno.com/create` in the dedicated persistent profile;
3. fills lyrics, style, exclude styles, and the instrumental toggle when the
   payload includes them;
4. clicks `button[aria-label="Create song"]` only when
   `music.suno.submitMode = "live"`;
5. polls `/create` generation cards every 3 seconds for up to 3 minutes and
   prefers those song URLs first;
6. if `/create` stays quiet, falls back to `https://suno.com/me` library diff
   polling for the remaining 7 minutes;
7. returns the new `/song/<uuid>` URLs once either lane observes them.

If no new song URLs appear before timeout, the driver returns
`playwright_live_timeout`.

## Round 41 import and audio download

After a successful Round 40 live create, the driver can now revisit the returned
`/song/<uuid>` URLs, extract the audio asset URL from the page payload, and save
the downloaded files under:

```txt
runtime/suno/<runId>/<trackId>.<mp3|m4a>
```

Import stays fail-closed:

- `urls=[]` returns `playwright_import_no_urls`
- direct `audio[src*=".mp3"]` is preferred, then `audio[src*=".m4a"]`, then the
  page payload script as fallback
- per-song failures are accumulated into `reason`
- at least one saved audio file is required for `accepted: true`
- partial success keeps the successful paths and reports the failed URLs in
  `reason`
- lightweight metadata (`title`, `durationSec`, `format`) is returned alongside
  saved paths and mirrored into `/api/status`

Round 49 now locks the cheap boundary cases in mock-only tests:

- extracted `.mp3` assets stay `.mp3` on disk and in metadata
- extracted `.m4a` fallback assets stay `.m4a` on disk and in metadata
- 404 downloads fail closed with empty imported paths and a recorded reason

## Imported assets in Producer Console

- Producer Console now mirrors the latest imported Suno asset evidence from
  `lastImportOutcome.paths` and `lastImportOutcome.metadata`.
- Imported assets are shown as read-only links plus static metadata (`title`,
  `durationSec`, `format`, `path`). There is no inline player, playback widget,
  or metadata editor in this lane.
- If no imported files have been recorded yet, the Console keeps the explicit
  placeholder `No imported assets yet.`

## Credit budget

`submitMode: "skip"` still consumes zero credits. `submitMode: "live"` now
consumes real Suno credits and should only be enabled after explicit operator
approval. Round 41 audio import/download does not create new generations on its
own; it only pulls finished outputs from the returned song URLs.

Round 51 adds a hard UTC-day credit gate in front of the live Create click:

- `music.suno.dailyCreditLimit` defaults to `60`
- each live submit reserves `10` credits before the Create click is allowed
- the counter persists in `runtime/suno/budget.json`
- the counter resets when `new Date().toISOString().slice(0, 10)` crosses into
  the next UTC day
- if the reservation would exceed the limit, the run fails closed with
  `budget_exhausted` and the Playwright submit path is never entered

## Rollback

Set `music.suno.driver` back to `mock` to return immediately to the built-in
dry-run-safe skeleton.

## See also

- `docs/CONNECTOR_AUTH.md`
- `docs/GATEWAY_AUTH.md`
- `SECURITY.md`
- `PRIVACY.md`
