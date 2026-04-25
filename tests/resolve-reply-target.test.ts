import { describe, expect, it, vi } from "vitest";
import { resolveReplyTarget } from "../src/connectors/social/resolveReplyTarget.js";

describe("resolveReplyTarget", () => {
  it("extracts an X status ID from a URL", async () => {
    await expect(resolveReplyTarget({ targetUrl: "https://x.com/ghost/status/1234567890" })).resolves.toEqual({
      ok: true,
      targetId: "1234567890",
      resolvedFrom: "https://x.com/ghost/status/1234567890"
    });
  });

  it("accepts a bare numeric target ID", async () => {
    await expect(resolveReplyTarget({ targetId: "9876543210" })).resolves.toEqual({
      ok: true,
      targetId: "9876543210",
      resolvedFrom: "targetId"
    });
  });

  it("rejects an empty target", async () => {
    await expect(resolveReplyTarget({})).resolves.toEqual({
      ok: false,
      reason: "reply_target_missing"
    });
  });

  it("expands t.co through an injected fetch implementation only", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      url: "https://twitter.com/ghost/status/5555555555",
      headers: new Headers()
    });

    await expect(resolveReplyTarget({ targetUrl: "https://t.co/abc123" }, { fetchImpl })).resolves.toEqual({
      ok: true,
      targetId: "5555555555",
      resolvedFrom: "https://t.co/abc123"
    });
    expect(fetchImpl).toHaveBeenCalledWith("https://t.co/abc123");
  });

  it("rejects invalid non-status URLs", async () => {
    await expect(resolveReplyTarget({ targetUrl: "https://example.com/not-a-status" })).resolves.toEqual({
      ok: false,
      reason: "reply_target_invalid",
      resolvedFrom: "https://example.com/not-a-status"
    });
  });
});
