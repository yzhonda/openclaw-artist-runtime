import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PlaywrightSunoDriver,
  PLAYWRIGHT_DRIVER_LOGIN_REQUIRED_DETAIL,
  SUNO_CREATE_URL
} from "../src/services/sunoPlaywrightDriver";

const { chromiumMock, launchPersistentContextMock, stealthPluginMock, stealthResult } = vi.hoisted(() => ({
  chromiumMock: {
    use: vi.fn(),
    launchPersistentContext: vi.fn()
  },
  launchPersistentContextMock: vi.fn(),
  stealthPluginMock: vi.fn(),
  stealthResult: { name: "stealth-plugin" }
}));

chromiumMock.launchPersistentContext = launchPersistentContextMock;

vi.mock("playwright-extra", () => ({
  chromium: chromiumMock
}));

vi.mock("puppeteer-extra-plugin-stealth", () => ({
  default: stealthPluginMock
}));

function createPage({
  url = "https://suno.com/create",
  selectorCounts = {}
}: {
  url?: string;
  selectorCounts?: Record<string, number>;
} = {}) {
  return {
    goto: vi.fn(async () => undefined),
    waitForLoadState: vi.fn(async () => undefined),
    url: vi.fn(() => url),
    locator: vi.fn((selector: string) => ({
      count: vi.fn(async () => selectorCounts[selector] ?? 0)
    }))
  };
}

function createContext(page = createPage()) {
  return {
    pages: vi.fn(() => [page]),
    newPage: vi.fn(async () => page),
    close: vi.fn(async () => undefined)
  };
}

describe("PlaywrightSunoDriver probe", () => {
  beforeEach(() => {
    chromiumMock.use.mockReset();
    launchPersistentContextMock.mockReset();
    stealthPluginMock.mockReset();
    stealthPluginMock.mockReturnValue(stealthResult);
  });

  it("returns connected when the create surface is already available", async () => {
    const page = createPage({
      url: "https://suno.com/create",
      selectorCounts: {
        "a[href='/create']": 1
      }
    });
    const context = createContext(page);
    launchPersistentContextMock.mockResolvedValue(context);
    const driver = new PlaywrightSunoDriver(".openclaw-browser-profiles/suno");

    const result = await driver.probe();

    expect(result.state).toBe("connected");
    expect(stealthPluginMock).toHaveBeenCalledTimes(1);
    expect(chromiumMock.use).toHaveBeenCalledWith(stealthResult);
    expect(page.goto).toHaveBeenCalledWith(SUNO_CREATE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 20_000
    });
    expect(context.close).toHaveBeenCalledTimes(1);
  });

  it("returns login_required when Suno redirects to sign-in", async () => {
    const page = createPage({
      url: "https://suno.com/sign-in",
      selectorCounts: {
        "input[type='password']": 1
      }
    });
    const context = createContext(page);
    launchPersistentContextMock.mockResolvedValue(context);
    const driver = new PlaywrightSunoDriver(".openclaw-browser-profiles/suno");

    const result = await driver.probe();

    expect(result).toEqual({
      state: "login_required",
      detail: PLAYWRIGHT_DRIVER_LOGIN_REQUIRED_DETAIL
    });
    expect(chromiumMock.use).toHaveBeenCalledWith(stealthResult);
    expect(context.close).toHaveBeenCalledTimes(1);
  });

  it("fails closed when Playwright launch raises an error", async () => {
    launchPersistentContextMock.mockRejectedValue(new Error("browser launch failed"));
    const driver = new PlaywrightSunoDriver(".openclaw-browser-profiles/suno");

    const result = await driver.probe();

    expect(result.state).toBe("disconnected");
    expect(result.detail).toContain("browser launch failed");
    expect(chromiumMock.use).toHaveBeenCalledWith(stealthResult);
  });
});
