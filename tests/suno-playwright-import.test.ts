import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PLAYWRIGHT_IMPORT_NO_URLS_REASON,
  PlaywrightSunoDriver
} from "../src/services/sunoPlaywrightDriver";

const {
  chromiumMock,
  launchPersistentContextMock,
  stealthPluginMock,
  stealthResult,
  mkdirMock,
  writeFileMock
} = vi.hoisted(() => ({
  chromiumMock: {
    use: vi.fn(),
    launchPersistentContext: vi.fn()
  },
  launchPersistentContextMock: vi.fn(),
  stealthPluginMock: vi.fn(),
  stealthResult: { name: "stealth-plugin" },
  mkdirMock: vi.fn(),
  writeFileMock: vi.fn()
}));

chromiumMock.launchPersistentContext = launchPersistentContextMock;

vi.mock("playwright-extra", () => ({
  chromium: chromiumMock
}));

vi.mock("puppeteer-extra-plugin-stealth", () => ({
  default: stealthPluginMock
}));

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    mkdir: mkdirMock,
    writeFile: writeFileMock
  };
});

function createContext(audioAssets: Array<{
  trackId: string;
  audioUrl: string;
  format?: "mp3" | "m4a";
  title?: string;
  durationSec?: number;
} | undefined>) {
  const page = {
    goto: vi.fn(async () => undefined),
    waitForLoadState: vi.fn(async () => undefined),
    evaluate: vi.fn(async () => audioAssets.shift())
  };
  const context = {
    pages: vi.fn(() => [page]),
    newPage: vi.fn(async () => page),
    close: vi.fn(async () => undefined)
  };
  return { page, context };
}

describe("PlaywrightSunoDriver importResults", () => {
  beforeEach(() => {
    chromiumMock.use.mockReset();
    launchPersistentContextMock.mockReset();
    stealthPluginMock.mockReset();
    stealthPluginMock.mockReturnValue(stealthResult);
    mkdirMock.mockReset();
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockReset();
    writeFileMock.mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn());
  });

  it("downloads audio for every imported Suno song URL", async () => {
    const { context } = createContext([
      {
        trackId: "song-1",
        audioUrl: "https://cdn1.suno.ai/song-1.mp3",
        format: "mp3",
        title: "Song One",
        durationSec: 181
      },
      {
        trackId: "song-2",
        audioUrl: "https://cdn1.suno.ai/song-2.mp3",
        format: "mp3",
        title: "Song Two",
        durationSec: 202
      }
    ]);
    launchPersistentContextMock.mockResolvedValue(context);
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([4, 5, 6]), { status: 200 }));
    const driver = new PlaywrightSunoDriver(".openclaw-browser-profiles/suno", "live", "/tmp/workspace");

    const result = await driver.importResults({
      runId: "run-import-1",
      urls: ["https://suno.com/song/song-1", "https://suno.com/song/song-2"]
    });

    expect(result).toMatchObject({
      accepted: true,
      runId: "run-import-1",
      urls: ["https://suno.com/song/song-1", "https://suno.com/song/song-2"],
      paths: [
        "/tmp/workspace/runtime/suno/run-import-1/song-1.mp3",
        "/tmp/workspace/runtime/suno/run-import-1/song-2.mp3"
      ],
      metadata: [
        {
          url: "https://suno.com/song/song-1",
          path: "/tmp/workspace/runtime/suno/run-import-1/song-1.mp3",
          title: "Song One",
          durationSec: 181,
          format: "mp3"
        },
        {
          url: "https://suno.com/song/song-2",
          path: "/tmp/workspace/runtime/suno/run-import-1/song-2.mp3",
          title: "Song Two",
          durationSec: 202,
          format: "mp3"
        }
      ],
      reason: "imported",
      dryRun: false
    });
    expect(writeFileMock).toHaveBeenCalledTimes(2);
  });

  it("returns accepted with a partial-failure reason when at least one download succeeds", async () => {
    const { context } = createContext([
      {
        trackId: "song-1",
        audioUrl: "https://cdn1.suno.ai/song-1.mp3",
        format: "mp3",
        title: "Song One"
      },
      undefined
    ]);
    launchPersistentContextMock.mockResolvedValue(context);
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    const driver = new PlaywrightSunoDriver(".openclaw-browser-profiles/suno", "live", "/tmp/workspace");

    const result = await driver.importResults({
      runId: "run-import-2",
      urls: ["https://suno.com/song/song-1", "https://suno.com/song/song-2"]
    });

    expect(result.accepted).toBe(true);
    expect(result.urls).toEqual(["https://suno.com/song/song-1"]);
    expect(result.paths).toEqual(["/tmp/workspace/runtime/suno/run-import-2/song-1.mp3"]);
    expect(result.reason).toContain("https://suno.com/song/song-2: audio asset not found");
    expect(writeFileMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to m4a when mp3 is unavailable and keeps metadata", async () => {
    const { context } = createContext([
      {
        trackId: "song-3",
        audioUrl: "https://cdn1.suno.ai/song-3.m4a",
        format: "m4a",
        title: "Song Three",
        durationSec: 144
      }
    ]);
    launchPersistentContextMock.mockResolvedValue(context);
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(new Response(new Uint8Array([7, 8, 9]), { status: 200 }));
    const driver = new PlaywrightSunoDriver(".openclaw-browser-profiles/suno", "live", "/tmp/workspace");

    const result = await driver.importResults({
      runId: "run-import-4",
      urls: ["https://suno.com/song/song-3"]
    });

    expect(result).toMatchObject({
      accepted: true,
      runId: "run-import-4",
      urls: ["https://suno.com/song/song-3"],
      paths: ["/tmp/workspace/runtime/suno/run-import-4/song-3.m4a"],
      metadata: [
        {
          url: "https://suno.com/song/song-3",
          path: "/tmp/workspace/runtime/suno/run-import-4/song-3.m4a",
          title: "Song Three",
          durationSec: 144,
          format: "m4a"
        }
      ],
      reason: "imported",
      dryRun: false
    });
  });

  it("fails closed when no song URLs are provided", async () => {
    const driver = new PlaywrightSunoDriver(".openclaw-browser-profiles/suno", "live", "/tmp/workspace");

    const result = await driver.importResults({
      runId: "run-import-3",
      urls: []
    });

    expect(result).toEqual({
      accepted: false,
      runId: "run-import-3",
      urls: [],
      paths: [],
      reason: PLAYWRIGHT_IMPORT_NO_URLS_REASON,
      dryRun: false
    });
    expect(launchPersistentContextMock).not.toHaveBeenCalled();
    expect(writeFileMock).not.toHaveBeenCalled();
  });
});
