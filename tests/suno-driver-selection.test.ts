import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultArtistRuntimeConfig } from "../src/config/defaultConfig";
import { SunoBrowserWorker, type SunoBrowserDriver } from "../src/services/sunoBrowserWorker";

const { spawnMock, launchPersistentContextMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  launchPersistentContextMock: vi.fn()
}));

vi.mock("node:child_process", () => ({
  spawn: spawnMock
}));

vi.mock("playwright", () => ({
  chromium: {
    launchPersistentContext: launchPersistentContextMock
  }
}));

function createProbeContext({
  url = "https://suno.com/sign-in",
  passwordFieldCount = 1
}: {
  url?: string;
  passwordFieldCount?: number;
} = {}) {
  const page = {
    goto: vi.fn(async () => undefined),
    waitForLoadState: vi.fn(async () => undefined),
    url: vi.fn(() => url),
    locator: vi.fn((selector: string) => ({
      count: vi.fn(async () => {
        if (selector === "input[type='password']") {
          return passwordFieldCount;
        }
        return 0;
      })
    }))
  };
  const context = {
    pages: vi.fn(() => [page]),
    newPage: vi.fn(async () => page),
    close: vi.fn(async () => undefined)
  };
  return { page, context };
}

function connectedDriver(): SunoBrowserDriver {
  return {
    async probe() {
      return { state: "connected" };
    }
  };
}

describe("Suno driver selection", () => {
  beforeEach(() => {
    spawnMock.mockReset();
    launchPersistentContextMock.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("keeps the default mock path when no driver mode is configured", async () => {
    const root = mkdtempSync(join(tmpdir(), "artist-runtime-suno-driver-default-"));
    const worker = new SunoBrowserWorker(root);

    const started = await worker.start();

    expect(started.state).toBe("login_required");
    expect(started.pendingAction).toBe("operator_login_required");
    expect(launchPersistentContextMock).not.toHaveBeenCalled();
    expect(spawnMock).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("selects the playwright driver when config requests it", async () => {
    const root = mkdtempSync(join(tmpdir(), "artist-runtime-suno-driver-playwright-"));
    const { context } = createProbeContext();
    launchPersistentContextMock.mockResolvedValue(context);

    const worker = new SunoBrowserWorker(root, {
      config: {
        ...defaultArtistRuntimeConfig,
        music: {
          ...defaultArtistRuntimeConfig.music,
          suno: {
            ...defaultArtistRuntimeConfig.music.suno,
            driver: "playwright"
          }
        }
      }
    });

    const started = await worker.start();

    expect(started.state).toBe("login_required");
    expect(launchPersistentContextMock).toHaveBeenCalledWith(".openclaw-browser-profiles/suno", {
      headless: false
    });
    expect(spawnMock).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("prefers an explicit driver over config-based selection", async () => {
    const root = mkdtempSync(join(tmpdir(), "artist-runtime-suno-driver-explicit-"));
    const worker = new SunoBrowserWorker(root, {
      config: {
        ...defaultArtistRuntimeConfig,
        music: {
          ...defaultArtistRuntimeConfig.music,
          suno: {
            ...defaultArtistRuntimeConfig.music.suno,
            driver: "playwright"
          }
        }
      }
    });

    const started = await worker.start({
      driver: connectedDriver()
    });

    expect(started.state).toBe("connected");
    expect(started.connected).toBe(true);
    expect(launchPersistentContextMock).not.toHaveBeenCalled();
    expect(spawnMock).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
