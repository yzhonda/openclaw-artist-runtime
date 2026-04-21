# Distribution Strategy

This package should be publishable to ClawHub and npm.

## Package root

The package root contains:

- `package.json` with OpenClaw compatibility metadata;
- `openclaw.plugin.json` manifest;
- built `dist/` output after build;
- static UI output after UI build;
- templates/prompts/schemas;
- marketplace disclosures.

## ClawHub readiness

ClawHub publishing should be tested with a dry run before release.
The package must not include local runtime data, browser profiles, token files, generated songs, or `.env` files.

## Connector split plan

The initial package can include connector scaffolds, but high-permission connectors should remain modular.
Future packages may split Suno, X/Bird, Instagram, and TikTok connectors into separately installable plugins.
