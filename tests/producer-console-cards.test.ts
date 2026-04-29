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
import {
  buildRuntimeOverridesSavePayload,
  SettingsRuntimeOverridesPanel,
  submitRuntimeOverrides,
  type RuntimeOverridesValues
} from "../ui/src/components/SettingsRuntimeOverridesPanel";

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

  it("renders runtime safety override settings and read-only env state", () => {
    const values: RuntimeOverridesValues = {
      sunoDailyBudget: { value: 99, source: "env", editable: false, defaultValue: 50, envVar: "OPENCLAW_SUNO_DAILY_BUDGET" },
      birdDailyMax: { value: 5, source: "default", editable: true, defaultValue: 5, envVar: "OPENCLAW_BIRD_DAILY_MAX" },
      birdMinIntervalMinutes: { value: 60, source: "default", editable: true, defaultValue: 60, envVar: "OPENCLAW_BIRD_MIN_INTERVAL_MINUTES" },
      autopilotIntervalMinutes: { value: 180, source: "default", editable: true, defaultValue: 180 }
    };
    const html = renderToStaticMarkup(
      React.createElement(SettingsRuntimeOverridesPanel, {
        values,
        busy: false,
        dryRun: true,
        liveGoArmed: false,
        onSave: vi.fn()
      })
    );

    expect(html).toContain("Runtime Safety Settings");
    expect(html).toContain("Suno daily budget");
    expect(html).toContain("source: env OPENCLAW_SUNO_DAILY_BUDGET");
    expect(html).toContain("Environment override is active");
    expect(html).toContain("dryRun: on");
    expect(html).toContain("liveGoArmed: held");
  });

  it("submits only editable runtime override fields", async () => {
    const values: RuntimeOverridesValues = {
      sunoDailyBudget: { value: 99, source: "env", editable: false, defaultValue: 50, envVar: "OPENCLAW_SUNO_DAILY_BUDGET" },
      birdDailyMax: { value: 5, source: "default", editable: true, defaultValue: 5, envVar: "OPENCLAW_BIRD_DAILY_MAX" },
      birdMinIntervalMinutes: { value: 60, source: "default", editable: true, defaultValue: 60, envVar: "OPENCLAW_BIRD_MIN_INTERVAL_MINUTES" },
      autopilotIntervalMinutes: { value: 180, source: "default", editable: true, defaultValue: 180 }
    };
    const draft = {
      sunoDailyBudget: "120",
      birdDailyMax: "7",
      birdMinIntervalMinutes: "90",
      autopilotIntervalMinutes: "240"
    };
    const onSave = vi.fn();

    expect(buildRuntimeOverridesSavePayload(values, draft)).toEqual({
      bird: { rateLimits: { dailyMax: 7, minIntervalMinutes: 90 } },
      autopilot: { intervalMinutes: 240 }
    });

    await submitRuntimeOverrides(onSave, values, draft);
    expect(onSave).toHaveBeenCalledWith({
      bird: { rateLimits: { dailyMax: 7, minIntervalMinutes: 90 } },
      autopilot: { intervalMinutes: 240 }
    });
  });
});
