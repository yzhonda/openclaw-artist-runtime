import React from "../ui/node_modules/react/index.js";
import { renderToStaticMarkup } from "../ui/node_modules/react-dom/server.node.js";
import { describe, expect, it, vi } from "vitest";
import { BudgetRateStatusStrip } from "../ui/src/components/BudgetRateStatusStrip";
import { ManualSongCreateCard, submitManualSongCreate } from "../ui/src/components/ManualSongCreateCard";
import { PendingApprovalsCard } from "../ui/src/components/PendingApprovalsCard";

describe("producer console cockpit cards", () => {
  it("renders budget/rate/detection status", () => {
    const html = renderToStaticMarkup(
      React.createElement(BudgetRateStatusStrip, {
        suno: { used: 2, limit: 50, remaining: 48 },
        bird: { todayCalls: 1, dailyMax: 5, minIntervalMinutes: 60, nextAllowedAt: "2026-04-29T02:00:00.000Z" },
        distribution: { spotify: { url: "https://open.spotify.com/test", detectedAt: "2026-04-29T01:00:00.000Z" } }
      })
    );

    expect(html).toContain("Today 2/50");
    expect(html).toContain("Today 1/5");
    expect(html).toContain("Spotify ✓");
    expect(html).toContain("Apple Music -");
  });

  it("renders pending approval summaries", () => {
    const html = renderToStaticMarkup(
      React.createElement(PendingApprovalsCard, {
        count: 1,
        recent: [{
          id: "changeset-song-test",
          domain: "song",
          summary: "Song update waiting.",
          fieldCount: 2,
          createdAt: "2026-04-29T01:00:00.000Z"
        }]
      })
    );

    expect(html).toContain("Pending Approvals");
    expect(html).toContain("Song update waiting.");
    expect(html).toContain("2 fields");
  });

  it("submits manual song create hints through the run-cycle API", async () => {
    const post = vi.fn(async () => ({ tickerOutcome: "ran" }));
    const html = renderToStaticMarkup(React.createElement(ManualSongCreateCard, { busy: false, onCreate: post }));

    expect(html).toContain("Ask artist to make a song");

    await submitManualSongCreate(post, "  rail news  ");
    expect(post).toHaveBeenCalledWith("/run-cycle", { manualSeed: { hint: "rail news" } });

    await submitManualSongCreate(post, "   ");
    expect(post).toHaveBeenLastCalledWith("/run-cycle", undefined);
  });
});
