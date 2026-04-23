import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultArtistRuntimeConfig } from "../src/config/defaultConfig";
import { ensureArtistWorkspace } from "../src/services/artistWorkspace";
import { createAndPersistSunoPromptPack } from "../src/services/sunoPromptPackFiles";
import { DEFAULT_SUNO_DAILY_CREDIT_LIMIT, SUNO_BUDGET_EXHAUSTED_REASON, SunoBudgetTracker } from "../src/services/sunoBudget";
import { generateSunoRun } from "../src/services/sunoRuns";

const { connectorStatusMock, connectorCreateMock } = vi.hoisted(() => ({
  connectorStatusMock: vi.fn(),
  connectorCreateMock: vi.fn()
}));

vi.mock("../src/connectors/suno/browserWorkerConnector.js", () => ({
  BrowserWorkerSunoConnector: vi.fn().mockImplementation(() => ({
    status: connectorStatusMock,
    create: connectorCreateMock,
    importResults: vi.fn()
  }))
}));

describe("SunoBudgetTracker", () => {
  beforeEach(() => {
    connectorStatusMock.mockReset();
    connectorCreateMock.mockReset();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("persists consumed credits when a reserve fits under the daily limit", async () => {
    const root = mkdtempSync(join(tmpdir(), "artist-runtime-suno-budget-"));
    const tracker = new SunoBudgetTracker(root, () => new Date("2026-04-23T00:00:00.000Z"));

    const result = await tracker.reserve(10, DEFAULT_SUNO_DAILY_CREDIT_LIMIT);
    const persisted = JSON.parse(await readFile(join(root, "runtime", "suno", "budget.json"), "utf8")) as {
      date: string;
      consumed: number;
    };

    expect(result).toEqual({
      ok: true,
      consumed: 10,
      limit: DEFAULT_SUNO_DAILY_CREDIT_LIMIT
    });
    expect(persisted).toEqual({
      date: "2026-04-23",
      consumed: 10
    });
  });

  it("blocks live submit before connector.create when the daily limit would be exceeded", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-23T12:00:00.000Z"));

    const root = mkdtempSync(join(tmpdir(), "artist-runtime-suno-budget-block-"));
    await ensureArtistWorkspace(root);
    await createAndPersistSunoPromptPack({
      workspaceRoot: root,
      songId: "song-001",
      songTitle: "Ghost Station",
      artistReason: "budget edge",
      lyricsText: "static signal",
      knowledgePackVersion: "test-pack"
    });
    await mkdir(join(root, "runtime", "suno"), { recursive: true });
    await writeFile(
      join(root, "runtime", "suno", "budget.json"),
      `${JSON.stringify({ date: "2026-04-23", consumed: 55 }, null, 2)}\n`,
      "utf8"
    );
    connectorStatusMock.mockResolvedValue({ state: "connected" });
    connectorCreateMock.mockResolvedValue({
      accepted: true,
      runId: "unexpected",
      reason: "unexpected",
      urls: ["https://suno.com/song/unexpected"]
    });

    const result = await generateSunoRun({
      workspaceRoot: root,
      songId: "song-001",
      config: {
        autopilot: {
          ...defaultArtistRuntimeConfig.autopilot,
          dryRun: false
        },
        music: {
          ...defaultArtistRuntimeConfig.music,
          suno: {
            ...defaultArtistRuntimeConfig.music.suno,
            submitMode: "live",
            dailyCreditLimit: 60
          }
        }
      }
    });
    const persisted = JSON.parse(await readFile(join(root, "runtime", "suno", "budget.json"), "utf8")) as {
      date: string;
      consumed: number;
    };

    expect(connectorCreateMock).not.toHaveBeenCalled();
    expect(result.status).toBe("failed");
    expect(result.error?.message).toBe(SUNO_BUDGET_EXHAUSTED_REASON);
    expect(persisted).toEqual({
      date: "2026-04-23",
      consumed: 55
    });
  });

  it("resets the counter on the next UTC day before reserving again", async () => {
    const root = mkdtempSync(join(tmpdir(), "artist-runtime-suno-budget-reset-"));
    await mkdir(join(root, "runtime", "suno"), { recursive: true });
    await writeFile(
      join(root, "runtime", "suno", "budget.json"),
      `${JSON.stringify({ date: "2026-04-22", consumed: 60 }, null, 2)}\n`,
      "utf8"
    );
    const tracker = new SunoBudgetTracker(root, () => new Date("2026-04-23T00:00:00.000Z"));

    const result = await tracker.reserve(10, DEFAULT_SUNO_DAILY_CREDIT_LIMIT);
    const persisted = JSON.parse(await readFile(join(root, "runtime", "suno", "budget.json"), "utf8")) as {
      date: string;
      consumed: number;
    };

    expect(result).toEqual({
      ok: true,
      consumed: 10,
      limit: DEFAULT_SUNO_DAILY_CREDIT_LIMIT
    });
    expect(persisted).toEqual({
      date: "2026-04-23",
      consumed: 10
    });
  });

  it("falls back to an empty state when budget.json contains invalid JSON", async () => {
    const root = mkdtempSync(join(tmpdir(), "artist-runtime-suno-budget-invalid-json-"));
    await mkdir(join(root, "runtime", "suno"), { recursive: true });
    await writeFile(join(root, "runtime", "suno", "budget.json"), "{not-valid-json", "utf8");
    const tracker = new SunoBudgetTracker(root, () => new Date("2026-04-23T00:00:00.000Z"));

    const state = await tracker.getState(DEFAULT_SUNO_DAILY_CREDIT_LIMIT);
    const reserve = await tracker.reserve(10, DEFAULT_SUNO_DAILY_CREDIT_LIMIT);
    const persisted = JSON.parse(await readFile(join(root, "runtime", "suno", "budget.json"), "utf8")) as {
      date: string;
      consumed: number;
    };

    expect(state).toEqual({
      date: "2026-04-23",
      consumed: 0,
      limit: DEFAULT_SUNO_DAILY_CREDIT_LIMIT,
      remaining: DEFAULT_SUNO_DAILY_CREDIT_LIMIT
    });
    expect(reserve).toEqual({
      ok: true,
      consumed: 10,
      limit: DEFAULT_SUNO_DAILY_CREDIT_LIMIT
    });
    expect(persisted).toEqual({
      date: "2026-04-23",
      consumed: 10
    });
  });

  it("writes through a temporary file and leaves only the final budget.json behind", async () => {
    const root = mkdtempSync(join(tmpdir(), "artist-runtime-suno-budget-atomic-"));
    const tracker = new SunoBudgetTracker(root, () => new Date("2026-04-23T00:00:00.000Z"));

    const result = await tracker.reserve(10, DEFAULT_SUNO_DAILY_CREDIT_LIMIT);
    const finalPath = join(root, "runtime", "suno", "budget.json");
    const tmpPath = `${finalPath}.tmp`;
    const finalContents = JSON.parse(await readFile(finalPath, "utf8")) as {
      date: string;
      consumed: number;
    };
    const tmpExists = await access(tmpPath).then(() => true).catch(() => false);

    expect(result).toEqual({
      ok: true,
      consumed: 10,
      limit: DEFAULT_SUNO_DAILY_CREDIT_LIMIT
    });
    expect(finalContents).toEqual({
      date: "2026-04-23",
      consumed: 10
    });
    expect(tmpExists).toBe(false);
  });
});
