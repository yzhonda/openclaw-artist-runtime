import React from "../ui/node_modules/react/index.js";
import { renderToStaticMarkup } from "../ui/node_modules/react-dom/server.node.js";
import { describe, expect, it, vi } from "vitest";
import { BudgetRateStatusStrip } from "../ui/src/components/BudgetRateStatusStrip";
import { ManualSongCreateCard, submitManualSongCreate } from "../ui/src/components/ManualSongCreateCard";
import { PendingApprovalsCard } from "../ui/src/components/PendingApprovalsCard";
import {
  buildProposalEditFields,
  PendingChangeSetCard,
  submitProposalEdit,
  submitProposalNo,
  submitProposalYes,
  type ProposalDetail
} from "../ui/src/components/PendingChangeSetCard";

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

  it("renders and submits pending ChangeSet controls", async () => {
    const proposal: ProposalDetail = {
      id: "changeset-song-test",
      domain: "song",
      summary: "Song notes need approval.",
      createdAt: "2026-04-29T01:00:00.000Z",
      fields: [
        {
          field: "notes",
          currentValue: "old note",
          proposedValue: "new note",
          reasoning: "producer mirror",
          status: "proposed"
        }
      ]
    };
    const onYes = vi.fn();
    const onNo = vi.fn();
    const onEdit = vi.fn();
    const html = renderToStaticMarkup(
      React.createElement(PendingChangeSetCard, {
        domain: "song",
        proposals: [proposal],
        busy: false,
        onYes,
        onNo,
        onEdit
      })
    );

    expect(html).toContain("Song ChangeSet");
    expect(html).toContain("Song notes need approval.");
    expect(html).toContain("producer mirror");

    await submitProposalYes(onYes, proposal.id);
    await submitProposalNo(onNo, proposal.id);
    const fields = buildProposalEditFields(proposal, { notes: "console edit" });
    await submitProposalEdit(onEdit, proposal.id, fields);

    expect(onYes).toHaveBeenCalledWith(proposal.id);
    expect(onNo).toHaveBeenCalledWith(proposal.id);
    expect(onEdit).toHaveBeenCalledWith(proposal.id, { notes: "console edit" });
  });

  it("renders empty pending ChangeSet state", () => {
    const html = renderToStaticMarkup(
      React.createElement(PendingChangeSetCard, {
        domain: "persona",
        proposals: [],
        busy: false,
        onYes: vi.fn(),
        onNo: vi.fn(),
        onEdit: vi.fn()
      })
    );

    expect(html).toContain("No pending persona ChangeSet.");
  });
});
