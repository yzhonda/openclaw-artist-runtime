import type { SunoPromptPack, SunoRun } from "../../types/suno.js";

export interface SunoConnector {
  id: string;
  checkConnection(): Promise<{ ok: boolean; message: string }>;
  generate(pack: SunoPromptPack): Promise<SunoRun>;
}