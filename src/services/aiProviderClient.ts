import type { AiReviewProvider } from "../types.js";

export interface AiProviderCallOptions {
  provider: AiReviewProvider;
}

export async function callAiProvider(prompt: string, options: AiProviderCallOptions): Promise<string> {
  if (options.provider === "mock") {
    return `Mock provider: ${prompt.slice(0, 200)}`;
  }
  return `AI provider '${options.provider}' is not configured. No external model call was made.`;
}
