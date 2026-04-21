import { Type } from "@sinclair/typebox";

export function registerSongTools(api: any): void {
  api.registerTool({
    name: "artist_song_create_brief",
    description: "Create a song brief for the public artist and save it to the song repository.",
    parameters: Type.Object({
      seed: Type.String(),
      titleHint: Type.Optional(Type.String()),
    }),
    async execute(_id: string, params: { seed: string; titleHint?: string }) {
      // TODO: Implement SongRepository + PromptLedger.
      return {
        content: [
          { type: "text", text: `TODO create song brief from seed: ${params.seed}` },
        ],
      };
    },
  });
}