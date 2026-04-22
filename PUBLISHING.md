# Publishing Guide

## Preconditions

Before publishing:

- Replace `@your-org` with the actual package scope.
- Replace repository, homepage, bugs, and author metadata.
- Verify current OpenClaw SDK entry points and compatibility values.
- Ensure `openclaw.plugin.json` is in the package root.
- Ensure `package.json.openclaw.extensions` points to built output.
- Ensure `package.json.openclaw.compat.pluginApi` and `minGatewayVersion` are present.
- Ensure no lifecycle `postinstall` scripts are required.
- Ensure no secrets, local profiles, songs, or runtime files are included.
- Ensure `SECURITY.md`, `PRIVACY.md`, `CAPABILITIES.md`, and `MARKETPLACE.md` are current.
- Ensure `docs/CONNECTOR_AUTH.md` is current if connector setup or refresh flow changed.
- Ensure `docs/GATEWAY_AUTH.md` still matches the actual gateway/plugin auth boundary.
- Ensure `ui/node_modules` is not included in the tarball.
- If connector verification is part of the release check, ensure operator-local
  auth prerequisites are present before testing:
  - X uses the `bird` CLI plus its authenticated local cookie/token store.
  - Instagram uses `OPENCLAW_INSTAGRAM_AUTH` or `OPENCLAW_INSTAGRAM_ACCESS_TOKEN`.
  - TikTok uses `OPENCLAW_TIKTOK_AUTH` or `OPENCLAW_TIKTOK_ACCESS_TOKEN`.
- Ensure those credentials remain local-only (shell profile / env injection) and
  are not written into logs, package files, or committed `.env` files.
- Use `docs/CONNECTOR_AUTH.md` as the operator-facing source of truth for setup,
  refresh, and connector health checks.

## Local verification

```bash
npm install
npm run typecheck
npm test
npm run build
npm run pack:verify
npm run pack:dry-run
```

Inspect `npm pack --dry-run` output. The tarball must include only intended distributable files.
In particular, `ui/dist/**` should be present and `ui/node_modules/**` must be absent.

## ClawHub dry run

```bash
npm i -g clawhub
clawhub login
npm run clawhub:dry-run
```

If the ClawHub CLI contract changes, update this file and `package.json` scripts.

## Publish

```bash
clawhub package publish .
```

Alternative npm path:

```bash
npm publish --access public
```

## Install smoke test

After publishing a private or test release:

```bash
openclaw plugins install clawhub:@your-org/openclaw-artist-runtime
openclaw gateway restart
openclaw plugins doctor
```

Then open the Producer Console route and confirm dry-run mode blocks external side effects.

## Release checklist

- [ ] Version bumped.
- [ ] Changelog updated.
- [ ] Compatibility matrix updated.
- [ ] Config schema migration tested.
- [ ] Marketplace screenshots updated.
- [ ] Security disclosures reviewed.
- [ ] Privacy disclosures reviewed.
- [ ] Gateway auth boundary reviewed against `docs/GATEWAY_AUTH.md`.
- [ ] Connector env / CLI prerequisites verified locally and excluded from package output.
- [ ] Package dry-run clean.
- [ ] ClawHub dry-run clean.
- [ ] Fresh workspace install tested.
