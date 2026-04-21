export function registerSocialApprovalGuard(api: any): void {
  // TODO: Verify current before_tool_call event shape and decision return type.
  // Intended behavior:
  // - block on hard stops
  // - require approval for official release and high-risk actions
  // - allow daily sharing inside configured authority
  if (!api.registerHook) return;

  api.registerHook?.(["before_tool_call"], async (event: any) => {
    const toolName = event?.toolName ?? event?.name;
    if (!toolName) return undefined;

    if (toolName === "artist_social_publish" || toolName === "artist_suno_generate") {
      // TODO: call SocialAuthority / SunoPolicy.
      return undefined;
    }
    return undefined;
  }, { id: "artist-runtime-policy-guard", priority: 100 });
}