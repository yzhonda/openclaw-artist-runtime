# Architecture

```text
OpenClaw Gateway
  └─ Artist Runtime native plugin
      ├─ Manifest/config schema/ui hints
      ├─ Producer Console route
      ├─ Tools
      ├─ Hooks
      ├─ Services
      ├─ Connectors
      ├─ Repositories
      ├─ Ledgers
      └─ Workspace templates
```

## Data separation

- Config: producer intent and policy.
- Workspace files: artist identity, songs, lyrics, prompts, public artifacts.
- Runtime store: connection status, counters, locks, token references.
- Browser profiles: dedicated service profiles, never creative Markdown files.

## Side effect path

```text
Autopilot or agent tool call
  -> Authority guard
  -> Risk/budget/cadence checks
  -> Connector execution
  -> Audit log
  -> Prompt Ledger link
```

Producer Console does not publish directly. It calls plugin APIs that use the same authority path.
