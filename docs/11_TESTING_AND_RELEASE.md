# Testing and Release

## Minimum tests

- config schema default validation;
- unknown config rejection;
- dry-run prevents connector execution;
- authority guard denies high-risk cases;
- ledger append-only behavior;
- package verification;
- Producer Console route smoke test.

## Release gates

Run:

```bash
npm run typecheck
npm test
npm run build
npm run pack:verify
npm run pack:dry-run
npm run clawhub:dry-run
```
