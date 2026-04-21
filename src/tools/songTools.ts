import { safeRegisterTool } from "../pluginApi.js";

export function registerSongTools(api: unknown): void {
  safeRegisterTool(api, {
    name: "artist_song_ideate",
    handler: async () => ({ status: "stub", action: "ideate_song" })
  });

  safeRegisterTool(api, {
    name: "artist_take_select",
    handler: async () => ({ status: "stub", action: "select_take" })
  });
}
