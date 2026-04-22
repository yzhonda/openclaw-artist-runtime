# Local OpenClaw Sandbox

Use this only for a repo-local, low-privilege OpenClaw install for `artist-runtime`.

## Goals

- Keep OpenClaw inside this repository only.
- Do not use `~/.openclaw`.
- Do not install `OpenClaw.app`.
- Do not run onboarding.
- Do not install a system service.
- Keep state, config, and workspace disposable.

## Layout

```text
.local/openclaw/
  bin/
  home/
  state/
  config/openclaw.json
  workspace/
  logs/
```

This layout is ignored by git through `.gitignore`.

## Helper scripts

- `scripts/openclaw-local-env.sh`
  - Exports repo-local `OPENCLAW_HOME`, `OPENCLAW_STATE_DIR`, and `OPENCLAW_CONFIG_PATH`.
- `scripts/openclaw-local`
  - Runs the repo-local OpenClaw binary with the isolated environment.
- `scripts/openclaw-local-install.sh`
  - Fetches the official `install-cli.sh` installer and installs into `.local/openclaw/`.

## Recommended flow

1. Inspect the isolated paths:

   ```bash
   scripts/openclaw-local-env.sh print
   ```

2. Install OpenClaw into the repo-local prefix:

   ```bash
   scripts/openclaw-local-install.sh
   ```

3. Verify the local CLI only:

   ```bash
   scripts/openclaw-local --help
   scripts/openclaw-local gateway status
   ```

4. Keep any later Gateway or plugin verification inside the same wrapper:

   ```bash
   scripts/openclaw-local plugins list
   ```

## Safety notes

- These scripts are designed to isolate filesystem paths, not to grant fewer macOS permissions than the shell already has.
- Do not run `openclaw onboard`.
- Do not run `openclaw channels login`.
- Do not install a daemon or LaunchAgent until plugin verification has passed in the local sandbox.
- Keep `artist-runtime` in dry-run during first verification.

## Official references

- Install overview: `https://docs.openclaw.ai/install`
- Installer internals: `https://docs.openclaw.ai/install/installer`
- Environment variables: `https://docs.openclaw.ai/help/environment`
