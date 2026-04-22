import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultArtistRuntimeConfig } from "../src/config/defaultConfig";
import { PlaywrightSunoDriver, PLAYWRIGHT_DRIVER_STUB_DETAIL } from "../src/services/sunoPlaywrightDriver";
import { SunoBrowserWorker, type SunoBrowserDriver } from "../src/services/sunoBrowserWorker";

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn()
}));

vi.mock("node:child_process", () => ({
  spawn: spawnMock
}));

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
    vi.stubGlobal("fetch", vi.fn());
  });

  it("keeps the default mock path when no driver mode is configured", async () => {
    const root = mkdtempSync(join(tmpdir(), "artist-runtime-suno-driver-default-"));
    const worker = new SunoBrowserWorker(root);

    const started = await worker.start();

    expect(started.state).toBe("login_required");
    expect(started.pendingAction).toBe("operator_login_required");
    expect(spawnMock).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("selects the playwright skeleton when config requests it", async () => {
    const root = mkdtempSync(join(tmpdir(), "artist-runtime-suno-driver-playwright-"));
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

    expect(started.state).toBe("disconnected");
    expect(started.connected).toBe(false);
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
    expect(spawnMock).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("returns the documented stub probe result", async () => {
    const driver = new PlaywrightSunoDriver(".openclaw-browser-profiles/suno");

    await expect(driver.probe()).resolves.toEqual({
      state: "disconnected",
      detail: PLAYWRIGHT_DRIVER_STUB_DETAIL
    });
    expect(spawnMock).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
