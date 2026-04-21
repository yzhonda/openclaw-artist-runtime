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
- [ ] Package dry-run clean.
- [ ] ClawHub dry-run clean.
- [ ] Fresh workspace install tested.
