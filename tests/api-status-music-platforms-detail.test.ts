import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildStatusResponse } from "../src/routes";
import { recordBirdCall, triggerCooldown } from "../src/services/birdRateLimiter";
import { ensureArtistWorkspace } from "../src/services/artistWorkspace";
import { tryConsumeBudget } from "../src/services/sunoBudgetLedger";

describe("music and platform status details", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("surfaces Suno daily budget detail, Bird ledger detail, and distribution detection checks", async () => {
    const root = mkdtempSync(join(tmpdir(), "artist-runtime-status-detail-"));
    await ensureArtistWorkspace(root);
    vi.stubEnv("OPENCLAW_SUNO_DAILY_BUDGET", "5");
    const budgetNow = new Date();
    const birdNow = new Date();

    await tryConsumeBudget(root, 2, budgetNow);
    await recordBirdCall(root, birdNow, {
      query: "rail noise",
      mode: "topical"
    });
    await triggerCooldown(root, "rate limit smoke", birdNow);

    const status = await buildStatusResponse({
      artist: { workspaceRoot: root }
    });

    expect(status.suno.budgetDetail).toMatchObject({
      used: 2,
      remaining: 3,
      limit: 5,
      todayCalls: [
        {
          timestamp: budgetNow.toISOString(),
          amount: 2,
          kind: "consume"
        }
      ]
    });
    expect(status.suno.budgetDetail?.lastResetAt).toEqual(expect.any(String));
    expect(status.bird?.ledger).toMatchObject({
      todayCalls: [
        {
          timestamp: birdNow.toISOString(),
          query: "rail noise",
          mode: "topical"
        }
      ],
      cooldown: {
        reason: "rate limit smoke"
      }
    });
    expect(status.bird?.ledger?.cooldown.until).toEqual(expect.any(String));
    expect(status.distribution?.detected.unitedMasters?.lastCheckedAt).toEqual(expect.any(String));
    expect(status.distribution?.detected.spotify?.lastCheckedAt).toEqual(expect.any(String));
    expect(status.distribution?.detected.appleMusic?.lastCheckedAt).toEqual(expect.any(String));
  });
});
