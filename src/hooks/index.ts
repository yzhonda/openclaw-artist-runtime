import { safeRegisterHook } from "../pluginApi.js";
import { bootstrapArtistContext } from "./bootstrapArtist.js";

export function registerHooks(api: unknown): void {
  safeRegisterHook(api, {
    event: "agent:bootstrap",
    handler: async (payload) => {
      const workspaceRoot = typeof payload === "object" && payload !== null && "workspaceRoot" in payload ? String((payload as { workspaceRoot: unknown }).workspaceRoot) : ".";
      return bootstrapArtistContext(workspaceRoot);
    }
  });

  safeRegisterHook(api, {
    event: "before_tool_call",
    handler: async () => ({ status: "guarded" })
  });

  safeRegisterHook(api, {
    event: "after_tool_call",
    handler: async () => ({ status: "audited" })
  });
}
