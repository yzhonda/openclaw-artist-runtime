import type { SocialPublishRequest } from "../types/social.js";
import type { PolicyDecision } from "../types/ledger.js";

const HIGH_RISK_TYPES = new Set(["release_announcement"]);

export function decideSocialPublish(req: SocialPublishRequest): PolicyDecision {
  if (HIGH_RISK_TYPES.has(req.postType)) {
    return { action: "require_approval", reason: "Official release or high-risk post type.", matchedRules: ["official_release_gate"] };
  }
  // TODO: use platform config, forbidden topics, risk classifier, quotas.
  return { action: "allow", reason: "Daily sharing type within default authority.", matchedRules: ["daily_sharing_default"] };
}