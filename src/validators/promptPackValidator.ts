import type { SunoPromptPack, SunoPromptPackValidation } from "../types.js";

export function validateSunoPromptPack(pack: Partial<SunoPromptPack>): SunoPromptPackValidation {
  const errors: string[] = [];
  if (!pack.songId) {
    errors.push("missing songId");
  }
  if (!pack.songTitle) {
    errors.push("missing songTitle");
  }
  if (!pack.style) {
    errors.push("missing style");
  }
  if (!pack.exclude) {
    errors.push("missing exclude");
  }
  if (!pack.yamlLyrics) {
    errors.push("missing YAML lyrics");
  }
  if (!pack.payload) {
    errors.push("missing payload");
  }
  if (!pack.artistSnapshotHash) {
    errors.push("missing artist snapshot hash");
  }
  if (!pack.currentStateHash) {
    errors.push("missing current state hash");
  }
  if (!pack.payloadHash) {
    errors.push("missing payload hash");
  }
  if (!pack.knowledgePackHash) {
    errors.push("missing knowledge pack hash");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
