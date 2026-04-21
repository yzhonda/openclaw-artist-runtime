import { Type } from "@sinclair/typebox";

export function registerSocialTools(api: any): void {
  api.registerTool({
    name: "artist_social_publish",
    description: "Publish a prepared daily-sharing social asset through the configured platform connector after policy checks.",
    parameters: Type.Object({
      platform: Type.Union([Type.Literal("x"), Type.Literal("instagram"), Type.Literal("tiktok")]),
      postType: Type.String(),
      text: Type.Optional(Type.String()),
      caption: Type.Optional(Type.String()),
      mediaPaths: Type.Optional(Type.Array(Type.String())),
      sourceSongId: Type.Optional(Type.String()),
      sourceTakeId: Type.Optional(Type.String()),
      artistReason: Type.String(),
    }),
    async execute(_id: string, params: any) {
      // TODO: route to SocialDistributionWorker / connector registry.
      return { content: [{ type: "text", text: `TODO publish to ${params.platform}` }] };
    },
  });
}