export interface ResolvedReplyTarget {
  ok: true;
  targetId: string;
  resolvedFrom: string;
}

export interface UnresolvedReplyTarget {
  ok: false;
  reason: "reply_target_missing" | "reply_target_invalid" | "reply_target_tco_requires_fetch" | "reply_target_tco_expand_failed";
  resolvedFrom?: string;
}

export type ReplyTargetResolution = ResolvedReplyTarget | UnresolvedReplyTarget;

export type ReplyTargetFetch = (url: string) => Promise<Pick<Response, "ok" | "url" | "headers">>;

const X_STATUS_URL = /^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/[^/?#]+\/status\/(\d+)/i;
const TCO_URL = /^https?:\/\/t\.co\/[A-Za-z0-9]+\/?$/i;

function idFromValue(value: string): string | undefined {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }
  return trimmed.match(X_STATUS_URL)?.[1];
}

export async function resolveReplyTarget(
  input: { targetId?: string; targetUrl?: string },
  options: { fetchImpl?: ReplyTargetFetch } = {}
): Promise<ReplyTargetResolution> {
  const targetId = input.targetId?.trim();
  if (targetId) {
    const id = idFromValue(targetId);
    return id ? { ok: true, targetId: id, resolvedFrom: "targetId" } : { ok: false, reason: "reply_target_invalid", resolvedFrom: "targetId" };
  }

  const targetUrl = input.targetUrl?.trim();
  if (!targetUrl) {
    return { ok: false, reason: "reply_target_missing" };
  }

  const directId = idFromValue(targetUrl);
  if (directId) {
    return { ok: true, targetId: directId, resolvedFrom: targetUrl };
  }

  if (!TCO_URL.test(targetUrl)) {
    return { ok: false, reason: "reply_target_invalid", resolvedFrom: targetUrl };
  }

  if (!options.fetchImpl) {
    return { ok: false, reason: "reply_target_tco_requires_fetch", resolvedFrom: targetUrl };
  }

  try {
    const response = await options.fetchImpl(targetUrl);
    const expanded = response.url || response.headers.get("location") || "";
    const expandedId = idFromValue(expanded);
    return expandedId
      ? { ok: true, targetId: expandedId, resolvedFrom: targetUrl }
      : { ok: false, reason: "reply_target_tco_expand_failed", resolvedFrom: targetUrl };
  } catch {
    return { ok: false, reason: "reply_target_tco_expand_failed", resolvedFrom: targetUrl };
  }
}
