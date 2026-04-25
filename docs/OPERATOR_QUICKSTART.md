# Operator Quickstart

This quickstart is the operator path from a fresh local checkout to a verified
dry-run and, later, an explicitly approved live social flow. It links back to
the detailed runbooks instead of repeating every recovery branch.

See also: [TROUBLESHOOTING.md](TROUBLESHOOTING.md),
[ERRORS.md](ERRORS.md), [API_ROUTES.md](API_ROUTES.md),
[CONNECTOR_AUTH.md](CONNECTOR_AUTH.md),
[SUNO_BROWSER_DRIVER.md](SUNO_BROWSER_DRIVER.md), and
[OPERATOR_RUNBOOK.md](OPERATOR_RUNBOOK.md).

## 0. Preconditions

- Work from the package root.
- Keep `.local/`, `runtime/`, `.env*`, and `.openclaw-browser-profiles/` local.
- Keep `autopilot.dryRun` enabled until the operator has verified the status
  surfaces and granted a separate live GO.
- Treat Instagram and TikTok as frozen lanes. The feature skeletons stay in the
  package, but the operator does not provision tokens or exercise probes for
  those lanes.

If any credential, profile, or runtime artifact appears in a PR, log, screenshot,
or chat transcript, stop and use
[TROUBLESHOOTING.md#credential-or-profile-exposure-concern](TROUBLESHOOTING.md#credential-or-profile-exposure-concern).

## 1. Prepare local credentials and profiles

### X / Bird

1. Sign in to the artist X account through Bird's supported local browser
   profile.
2. If the artist account uses a dedicated Firefox profile, put only the profile
   basename in `.local/social-credentials.env`:

   ```sh
   BIRD_FIREFOX_PROFILE=profile-basename
   ```

3. Start shells through `scripts/openclaw-local-env.sh` so
   `OPENCLAW_X_FIREFOX_PROFILE` is exported for runtime Bird calls.
4. Confirm the selected account outside the plugin:

   ```sh
   bird --firefox-profile "$OPENCLAW_X_FIREFOX_PROFILE" whoami --plain
   ```

Expected success: the artist `@handle` is returned.

If this fails, use [TROUBLESHOOTING.md#x-probe-red](TROUBLESHOOTING.md#x-probe-red)
and the X section of [CONNECTOR_AUTH.md#x-bird](CONNECTOR_AUTH.md#x-bird).

### Suno

1. Install the browser binary on the operator machine when needed:

   ```sh
   npx playwright install chromium
   ```

2. Run the manual login helper:

   ```sh
   scripts/openclaw-suno-login.sh
   ```

3. Complete Google OAuth manually and close the browser after the authenticated
   Suno surface loads.

Expected success: the dedicated profile remains under
`.openclaw-browser-profiles/suno/`.

If login or profile startup fails, use
[TROUBLESHOOTING.md#suno-profile-stale-or-corrupt](TROUBLESHOOTING.md#suno-profile-stale-or-corrupt)
and [SUNO_BROWSER_DRIVER.md#operator-recovery](SUNO_BROWSER_DRIVER.md#operator-recovery).

### Instagram and TikTok

Do not provision new Instagram or TikTok credentials. Both lanes are frozen by
operator decision. Their existing skeletons remain test-covered and fail-closed.

If a frozen-lane event appears, use
[TROUBLESHOOTING.md#igtiktok-frozen-attempt](TROUBLESHOOTING.md#igtiktok-frozen-attempt).

## 2. Start the local Gateway

```sh
source scripts/openclaw-local-env.sh
scripts/openclaw-local-gateway start
```

Expected success: the local Gateway reports a running process and the plugin API
responds.

Useful checks:

```sh
scripts/openclaw-local-gateway status
scripts/openclaw-local-http-smoke.sh
```

If the Gateway does not start, use
[TROUBLESHOOTING.md#gateway-startup-failure](TROUBLESHOOTING.md#gateway-startup-failure).

## 3. Verify probes

Use the platform test routes cataloged in
[API_ROUTES.md#platform-test-route-anchors](API_ROUTES.md#platform-test-route-anchors).

### X probe

```sh
curl -sS -X POST http://127.0.0.1:43134/plugins/artist-runtime/api/platforms/x/test
```

Expected success:

- `connected: true`
- `accountLabel` matches the artist account
- `authStatus: "tested"`
- `lastTestedAt` is persisted in config overrides

If the reason is `bird_cli_not_installed`, `bird_auth_expired`, or
`bird_probe_failed`, use [ERRORS.md#bird_probe_failed](ERRORS.md#bird_probe_failed)
and [TROUBLESHOOTING.md#x-probe-red](TROUBLESHOOTING.md#x-probe-red).

### Suno status

```sh
curl -sS http://127.0.0.1:43134/plugins/artist-runtime/api/suno/status
curl -sS http://127.0.0.1:43134/plugins/artist-runtime/api/status
```

Expected success:

- Suno worker status is visible
- `suno.budget.remaining` is non-negative
- `suno.profile.stale` is absent or `false`

If budget is exhausted, use
[TROUBLESHOOTING.md#suno-budget-exhausted](TROUBLESHOOTING.md#suno-budget-exhausted).
If the profile is stale, use
[TROUBLESHOOTING.md#suno-profile-stale-or-corrupt](TROUBLESHOOTING.md#suno-profile-stale-or-corrupt).

## 4. Review arm flags

Artist Runtime uses multiple social guards:

- `autopilot.dryRun`
- `distribution.enabled`
- `distribution.liveGoArmed`
- `distribution.platforms.<platform>.enabled`
- `distribution.platforms.<platform>.liveGoArmed`
- connector edge checks such as
  [ERRORS.md#requires_explicit_live_go](ERRORS.md#requires_explicit_live_go)

The status surface exposes the effective result:

```sh
curl -sS http://127.0.0.1:43134/plugins/artist-runtime/api/status
```

Expected dry-run setup state:

- `summary.allPlatformsEffectivelyDryRun: true`
- X can be probed and staged
- Instagram and TikTok remain frozen

If the dry-run banner stays on unexpectedly, use
[TROUBLESHOOTING.md#dry-run-banner-stays-on](TROUBLESHOOTING.md#dry-run-banner-stays-on).

## 5. Confirm a dry-run action

Use Producer Console or the API to simulate an X reply. This must remain
dry-run:

```sh
curl -sS -X POST http://127.0.0.1:43134/plugins/artist-runtime/api/platforms/x/simulate-reply \
  -H 'content-type: application/json' \
  --data '{"targetId":"1900000000000000000","text":"dry-run check"}'
```

Expected success:

- response contains a dry-run result
- no public reply is posted
- the social ledger records reply-target audit metadata

If config patching or dry-run action calls fail, use
[TROUBLESHOOTING.md#config-patch-failure](TROUBLESHOOTING.md#config-patch-failure)
or [TROUBLESHOOTING.md#x-probe-red](TROUBLESHOOTING.md#x-probe-red).

## 6. Live publish flow

Live social publishing is not enabled by this quickstart. The operator must make
a separate explicit GO before any lane changes from fail-closed rehearsal to
real publish.

Before that GO:

1. Confirm X probe shows the artist account.
2. Confirm dry-run ledger entries look correct.
3. Confirm `distribution.liveGoArmed` and the X platform arm are intentionally
   set.
4. Confirm the connector edge still rejects accidental live attempts with
   [ERRORS.md#requires_explicit_live_go](ERRORS.md#requires_explicit_live_go).
5. Keep Instagram and TikTok frozen.

Rollback path: use `scripts/reset-config.sh` and the operator notes in
[OPERATOR_RUNBOOK.md](OPERATOR_RUNBOOK.md) if a config experiment needs to be
discarded.

## 7. Operator maintenance helpers

Run the doctor after setup and after any recovery:

```sh
scripts/openclaw-doctor.sh
scripts/openclaw-doctor.sh --json
```

For local state maintenance:

```sh
scripts/rotate-runtime-logs.sh --dry-run
scripts/snapshot-runtime-state.sh --dry-run
scripts/runtime-disk-usage.sh --json
```

See [OPERATOR_RUNBOOK.md](OPERATOR_RUNBOOK.md) for script details and cron
examples. If disk pressure appears, use
[TROUBLESHOOTING.md#disk-usage-warning](TROUBLESHOOTING.md#disk-usage-warning)
and [RUNTIME_CLEANUP.md](RUNTIME_CLEANUP.md).

## 8. Where to go next

- Route catalog: [API_ROUTES.md](API_ROUTES.md)
- Connector setup: [CONNECTOR_AUTH.md](CONNECTOR_AUTH.md)
- Suno browser lane: [SUNO_BROWSER_DRIVER.md](SUNO_BROWSER_DRIVER.md)
- Reason-code catalog: [ERRORS.md](ERRORS.md)
- Symptom decision tree: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
