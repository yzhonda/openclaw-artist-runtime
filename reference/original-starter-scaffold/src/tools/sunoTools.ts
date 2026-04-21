import { Type } from "@sinclair/typebox";

export function registerSunoTools(api: any): void {
  api.registerTool({
    name: "artist_suno_create_prompt_pack",
    description: "Create and persist a complete Suno prompt pack for a song, including Style, Exclude, YAML lyrics, sliders, payload, validation, and prompt ledger entries.",
    parameters: Type.Object({
      songId: Type.String(),
      force: Type.Optional(Type.Boolean()),
    }),
    async execute(_id: string, params: { songId: string; force?: boolean }) {
      // TODO: call packages/suno-production createSunoPromptPack and PromptLedger.
      return { content: [{ type: "text", text: `TODO create Suno prompt pack for ${params.songId}` }] };
    },
  });

  api.registerTool({
    name: "artist_suno_generate",
    description: "Run Suno generation for a validated prompt pack through the configured Suno connector/worker.",
    parameters: Type.Object({
      songId: Type.String(),
      promptPackPath: Type.Optional(Type.String()),
    }),
    async execute(_id: string, params: { songId: string; promptPackPath?: string }) {
      // TODO: policy guard must enforce budget/hard stops before this runs.
      return { content: [{ type: "text", text: `TODO generate Suno track for ${params.songId}` }] };
    },
  });
}