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
- Each imported asset row also provides a copy-path button so the operator can
  hand the absolute path off to Finder, a local player, or another local tool
  without exposing the runtime directory over HTTP.
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

Round 52 exposes that same counter back to the operator without mutating it:

- `/api/status` now returns `suno.budget = { date, consumed, limit, remaining }`
- Producer Console renders a read-only budget card with the UTC date and a
  progress bar
- the bar turns warning at `80%` consumed and error at `100%`
- read-only views call `getState()` only, so they never reset or reserve budget
  by side effect

## Operator recovery

Use these flows when the dedicated Suno browser profile needs operator recovery.
Every action here is operator-run on the local machine. Keep the same security
boundary as `SECURITY.md` / `PRIVACY.md`: do not paste profile contents,
cookies, session tokens, screenshots, or chat transcripts into PRs, logs, or
shared threads.

### Scenario A: profile corruption

Use this when the browser lane starts failing at launch, the profile directory
is unreadable, or repeated login probes keep failing after ordinary retry.

1. Stop the local Gateway/runtime before touching the profile directory.
2. Rename `.openclaw-browser-profiles/suno/` to a backup path such as
   `.openclaw-browser-profiles/suno.bak-YYYYMMDD-HHMMSS` instead of deleting it.
3. Create a fresh empty `.openclaw-browser-profiles/suno/` directory.
4. Rerun `scripts/openclaw-suno-login.sh` so the driver launches the fresh
   persistent profile with the existing stealth-plugin + `channel: "chrome"`
   lane.
5. Complete Google OAuth manually as the operator, then close the browser.
6. Re-run the login probe and confirm it returns `connected: true` before
   resuming normal use.

### Scenario B: Google OAuth reauthentication required

Use this when the probe starts returning `login_required`, the Suno session
expires, or another machine/logout invalidates the current cookie state.

1. Treat `login_required` as a manual-operator handoff, not an automation bug.
2. Re-run `scripts/openclaw-suno-login.sh`.
3. Complete the Google OAuth flow manually in the Chrome-channel browser window.
   The runtime must not auto-script this step.
4. Close the browser once the operator reaches the authenticated Suno surface.
5. Re-run the probe and confirm it returns `connected: true`.

### Scenario C: profile migration

Use this when the operator moves the Suno lane to a different Mac or a different
local user account.

1. Stop the runtime on both source and destination machines before copying the
   profile directory.
2. Copy `.openclaw-browser-profiles/suno/` as a whole directory; do not cherry-
   pick internal Chromium files because the exact layout can vary by version.
3. After copy, verify filesystem ownership/permissions so the destination user
   can read and write the profile.
4. Expect Chrome / Chromium version differences and OS path differences to
   invalidate the moved session; if that happens, fall back to Scenario B and
   reauthenticate manually.
5. Re-run the probe on the destination machine and require `connected: true`
   before trusting the migrated profile.

### Scenario D: credit budget exhausted

Use this when a live create attempt returns `accepted: false` with
`reason: "budget_exhausted"`.

1. Inspect the current budget state through Producer Console or `/api/status`
   rather than editing the persistence file directly.
2. If the daily cap is too low for the operator's current lane, adjust
   `music.suno.dailyCreditLimit` through the normal config workflow.
3. If no config change is desired, wait for the next UTC day boundary; the
   runtime resets the visible counter automatically when the date changes.
4. After the UTC boundary or config change, re-check the status surface and
   confirm `remaining` has reopened before attempting another live create.

## Artifact retention

- Imported artifacts under `runtime/suno/<runId>/` are kept indefinitely by
  default. The runtime does not auto-delete completed mp3/m4a imports or their
  lightweight metadata.
- The operator should treat artifact cleanup as a manual maintenance task and
  review older `runId` directories on a monthly or half-year cadence.
- Before sharing, exporting, or uploading retained artifacts, the operator
  should manually review the audio, lyrics alignment, and lightweight metadata.
- Artifact deletion and budget state are separate layers. Removing
  `runtime/suno/<runId>/` does not reset or lower the UTC-day credit counter.
- If the operator intentionally needs to alter the current budget counter, that
  is a separate manual decision against `runtime/suno/budget.json`; deleting an
  imported run directory alone does not change the Round 51/52 budget state.

## Troubleshooting

- Login probe says `login_required`: follow Scenario B.
- Browser/profile fails to launch or repeated login probes collapse: follow
  Scenario A.
- Moving the Suno lane to another operator machine or account: follow
  Scenario C.
- Live create fails with `budget_exhausted`: follow Scenario D.

## Rollback

Set `music.suno.driver` back to `mock` to return immediately to the built-in
dry-run-safe skeleton.

## See also

- `docs/CONNECTOR_AUTH.md`
- `docs/GATEWAY_AUTH.md`
- `SECURITY.md`
- `PRIVACY.md`
