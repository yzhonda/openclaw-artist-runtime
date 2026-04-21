export function registerBootstrapArtistHook(api: any): void {
  // TODO: Verify current OpenClaw hook event names and payload shape.
  // Intended behavior: inject artist runtime state from ARTIST.md, CURRENT_STATE.md,
  // SOCIAL_VOICE.md, RELEASE_POLICY.md, and active song summaries into agent bootstrap.
  if (!api.registerHook) return;

  api.registerHook?.(["agent:bootstrap"], async (_event: any) => {
    return undefined;
  }, { id: "artist-runtime-bootstrap" });
}