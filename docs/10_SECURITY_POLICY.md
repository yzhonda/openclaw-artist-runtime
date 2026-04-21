# Security Policy for Implementation

See root `SECURITY.md` and `PRIVACY.md` for marketplace-facing text.

## Required guards

- MusicAuthority.
- SocialAuthority.
- RiskClassifier.
- BudgetLimiter.
- DryRunGuard.

## Failure mode

Fail closed. Log a safe diagnostic. Surface alert in Producer Console.

## Secrets

Never include secrets in Prompt Ledger, audit log, UI screenshots, or bug reports.
