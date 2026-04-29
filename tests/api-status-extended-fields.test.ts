import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildStatusResponse } from "../src/routes";
import { createConversationalSession } from "../src/services/conversationalSession";
import { ensureArtistWorkspace } from "../src/services/artistWorkspace";
import { recordBirdCall } from "../src/services/birdRateLimiter";
import { tryConsumeBudget } from "../src/services/sunoBudgetLedger";

describe("extended status fields", () => {
  it("surfaces suno budget, bird rate limits, distribution detection stub, and pending approvals", async () => {
    const root = mkdtempSync(join(tmpdir(), "artist-runtime-status-extended-"));
    await ensureArtistWorkspace(root);
    vi.stubEnv("OPENCLAW_SUNO_DAILY_BUDGET", "4");
    await tryConsumeBudget(root, 1, new Date("2026-04-29T01:00:00.000Z"));
    await recordBirdCall(root, new Date("2026-04-29T01:00:00.000Z"));
    await createConversationalSession(root, {
      chatId: 1,
      userId: 2,
      topic: { kind: "persona" },
      pendingChangeSet: {
        id: "changeset-persona-test",
        domain: "persona",
        summary: "Persona change awaiting producer approval.",
        fields: [
          {
            domain: "persona",
            targetFile: "ARTIST.md",
            field: "socialVoice",
            proposedValue: "short and sharp",
            status: "proposed"
          }
        ],
        warnings: [],
        createdAt: "2026-04-29T01:02:00.000Z",
        source: "conversation"
      },
      now: Date.now()
    });

    const status = await buildStatusResponse({
      artist: { workspaceRoot: root },
      music: { suno: { dailyCreditLimit: 4 } }
    });

    expect(status.suno.budget).toMatchObject({
      used: 1,
      remaining: 4,
      limit: 4
    });
    expect(status.bird?.rateLimit).toMatchObject({
      todayCalls: 1,
      dailyMax: 5,
      minIntervalMinutes: 60
    });
    expect(status.distribution?.detected).toEqual({});
    expect(status.pendingApprovals).toMatchObject({
      count: 1,
      recent: [
        {
          id: "changeset-persona-test",
          domain: "persona",
          summary: "Persona change awaiting producer approval.",
          fieldCount: 1,
          createdAt: "2026-04-29T01:02:00.000Z"
        }
      ]
    });
    vi.unstubAllEnvs();
  });
});
