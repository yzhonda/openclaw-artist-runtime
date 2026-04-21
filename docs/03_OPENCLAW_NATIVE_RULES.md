# OpenClaw-native Rules

Use plugin surfaces instead of replacing OpenClaw internals.

## Use

- `openclaw.plugin.json` config schema and UI hints.
- Plugin entry point.
- Tool registration.
- Hook registration.
- Service registration.
- HTTP routes for Producer Console.
- OpenClaw/browser profile facilities where available.

## Avoid

- OpenClaw forks.
- Internal imports.
- Independent agent loops.
- Frontend-direct publishing.
- Browser credential capture.
- CAPTCHA/payment challenge bypass.
- Unbounded background loops.
