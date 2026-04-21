# Security and Policy

## Trust model

Artist Runtime is powerful. It can create public posts and operate a logged-in browser profile. Treat it as trusted operator code running inside OpenClaw.

## Dedicated environment

Recommended deployment:

- dedicated Mac user or machine,
- dedicated browser profile,
- dedicated artist accounts,
- no personal password manager in the artist profile,
- no personal Google/Apple accounts in the runtime browser,
- OpenClaw Gateway auth enabled.

## Credentials

- Do not store passwords in config.
- OAuth tokens must be stored only via approved runtime storage/secrets path.
- Browser sessions stay in dedicated profile directory.
- Never expose token values in Producer Console or logs.

## Hard stops

Always stop and alert on:

- CAPTCHA,
- login challenge,
- payment prompt,
- credit purchase prompt,
- suspicious account warning,
- platform terms/update dialog requiring human acceptance,
- UI selector mismatch,
- unexpected navigation to account settings/payment,
- high-risk content classification,
- repeated failures.

## Public content rules

Never auto-publish:

- direct imitation of a named artist,
- voice cloning or identity implication without explicit consent,
- private person claims,
- legal/medical/financial advice,
- political/religious inflammatory content,
- harassment,
- personal data,
- paid ads/spend,
- official release if `officialRelease` is approval-gated.

## Daily sharing vs official release

Daily sharing may be automatic:

- lyric fragments,
- studio notes,
- demo teasers,
- short clips,
- Suno link.

Official release should be a separate policy:

- streaming distribution,
- release metadata,
- campaign announcements,
- collaborations,
- paid promotion.

## Auditing

Public action logs must include:

- content hash,
- full text/caption file ref,
- media file refs,
- platform,
- account,
- policy decision,
- run ID,
- verification result,
- URL.