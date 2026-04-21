# Source Notes for Implementers

Verify all external platform APIs at implementation time.

Known design assumptions at package creation:

- ClawHub is the public OpenClaw registry for plugins and skills.
- External plugins should include package metadata and OpenClaw compatibility metadata.
- OpenClaw plugin settings are rendered from `configSchema` and `uiHints`.
- X integration uses Bird as a connector wrapper.
- Instagram and TikTok use official publishing APIs where available.
- Suno browser automation must avoid bypassing login challenges, CAPTCHA, or payment prompts.
