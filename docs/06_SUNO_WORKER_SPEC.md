# Suno Worker Spec

Suno is the primary music engine.

## Modes

- `manual_copy` — reliable fallback; no automation.
- `background_browser_worker` — dedicated logged-in browser profile, no user screen required during normal operation.
- `api_provider` — future official/approved provider mode.

## Hard stops

The worker must stop on:

- login challenge;
- CAPTCHA or bot challenge;
- payment prompt;
- UI mismatch;
- quota exhaustion;
- repeated generation failure;
- missing Prompt Ledger pre-save.

## Pre-generation persistence

Before Suno create, persist:

- ARTIST snapshot hash;
- CURRENT_STATE snapshot hash;
- song brief;
- lyrics;
- YAML lyrics;
- Style;
- Exclude;
- sliders;
- payload JSON;
- payload hash;
- authority decision.

## Result import

Import URLs/takes when possible. Fallback to manual URL import through Producer Console.
