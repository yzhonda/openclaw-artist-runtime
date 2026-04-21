export type PolicyDecision = {
  action: "allow" | "block" | "require_approval";
  reason: string;
  matchedRules: string[];
};

export type PromptLedgerEntry = {
  id: string;
  timestamp: string;
  stage: string;
  songId?: string;
  runId?: string;
  actor: "artist" | "producer" | "system" | "connector";
  artistReason?: string;
  inputRefs: string[];
  outputRefs: string[];
  promptText?: string;
  promptHash?: string;
  outputSummary?: string;
  outputHash?: string;
  artistSnapshotHash?: string;
  currentStateHash?: string;
  knowledgePackHash?: string;
  policyDecision?: PolicyDecision;
  verification?: { ok: boolean; details?: string };
  error?: { message: string; code?: string; stack?: string };
};