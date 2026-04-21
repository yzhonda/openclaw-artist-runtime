import { safeRegisterTool } from "../pluginApi.js";
import { publishSocialAction } from "../services/socialPublishing.js";

export function registerSocialTools(api: unknown): void {
  safeRegisterTool(api, {
    name: "artist_social_publish",
    handler: async (input) => {
      const payload = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
      return publishSocialAction({
        workspaceRoot: typeof payload.workspaceRoot === "string" ? payload.workspaceRoot : ".",
        songId: typeof payload.songId === "string" ? payload.songId : "song-001",
        platform: payload.platform === "instagram" || payload.platform === "tiktok" ? payload.platform : "x",
        postType: typeof payload.postType === "string" ? payload.postType : "observation",
        text: typeof payload.text === "string" ? payload.text : undefined,
        mediaPaths: Array.isArray(payload.mediaPaths) ? payload.mediaPaths.filter((value): value is string => typeof value === "string") : [],
        risk: payload.risk === "medium" || payload.risk === "high" ? payload.risk : "low",
        config: typeof payload.config === "object" && payload.config !== null ? (payload.config as Record<string, unknown>) : undefined,
        action: "publish"
      });
    }
  });

  safeRegisterTool(api, {
    name: "artist_social_reply",
    handler: async (input) => {
      const payload = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
      return publishSocialAction({
        workspaceRoot: typeof payload.workspaceRoot === "string" ? payload.workspaceRoot : ".",
        songId: typeof payload.songId === "string" ? payload.songId : "song-001",
        platform: payload.platform === "instagram" || payload.platform === "tiktok" ? payload.platform : "x",
        postType: typeof payload.postType === "string" ? payload.postType : "reply",
        text: typeof payload.text === "string" ? payload.text : undefined,
        mediaPaths: Array.isArray(payload.mediaPaths) ? payload.mediaPaths.filter((value): value is string => typeof value === "string") : [],
        risk: payload.risk === "medium" || payload.risk === "high" ? payload.risk : "low",
        config: typeof payload.config === "object" && payload.config !== null ? (payload.config as Record<string, unknown>) : undefined,
        action: "reply"
      });
    }
  });
}
