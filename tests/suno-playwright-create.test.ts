import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PLAYWRIGHT_CREATE_LIVE_DISABLED_REASON,
  PLAYWRIGHT_CREATE_SKIPPED_REASON,
  PlaywrightSunoDriver,
  SUNO_CREATE_URL
} from "../src/services/sunoPlaywrightDriver";

const {
  chromiumMock,
  launchPersistentContextMock,
  stealthPluginMock,
  stealthResult
} = vi.hoisted(() => ({
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

function createPage() {
  const clicks: string[] = [];
  const fills: Array<{ selector: string; value: string }> = [];
  const attributes: Record<string, string | null> = {
    "button[aria-label=\"Check this to generate an instrumental only song\"]": "false"
  };
  const counts: Record<string, number> = {
    "textarea[data-testid=\"lyrics-textarea\"]": 1
  };
  return {
    clicks,
    fills,
    goto: vi.fn(async () => undefined),
    waitForLoadState: vi.fn(async () => undefined),
    locator: vi.fn((selector: string) => ({
      first: () => ({
        fill: vi.fn(async (value: string) => {
          fills.push({ selector, value });
        })
      }),
      fill: vi.fn(async (value: string) => {
        fills.push({ selector, value });
      }),
      click: vi.fn(async () => {
        clicks.push(selector);
      }),
      count: vi.fn(async () => counts[selector] ?? 0),
      getAttribute: vi.fn(async (name: string) => (name === "aria-pressed" ? attributes[selector] ?? null : null))
    }))
  };
}

function createContext(page = createPage()) {
  return {
    page,
    context: {
      pages: vi.fn(() => [page]),
      newPage: vi.fn(async () => page),
      close: vi.fn(async () => undefined)
    }
  };
}

describe("PlaywrightSunoDriver create", () => {
  beforeEach(() => {
    chromiumMock.use.mockReset();
    launchPersistentContextMock.mockReset();
    stealthPluginMock.mockReset();
    stealthPluginMock.mockReturnValue(stealthResult);
  });

  it("fills lyrics, style, and exclude fields without clicking Create in skip mode", async () => {
    const { page, context } = createContext();
    launchPersistentContextMock.mockResolvedValue(context);
    const driver = new PlaywrightSunoDriver(".openclaw-browser-profiles/suno", "skip");

    const result = await driver.create({
      dryRun: false,
      authority: "auto_create_and_select_take",
      runId: "run-001",
      payload: {
        lyrics: "line one\nline two",
        styleAndFeel: "cold synth texture",
        excludeStyles: "generic edm drop",
        instrumental: false
      }
    });

    expect(result.reason).toBe(PLAYWRIGHT_CREATE_SKIPPED_REASON);
    expect(page.goto).toHaveBeenCalledWith(SUNO_CREATE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 20_000
    });
    expect(page.fills).toContainEqual({
      selector: "textarea[data-testid=\"lyrics-textarea\"]",
      value: "line one\nline two"
    });
    expect(page.fills).toContainEqual({
      selector: "textarea[placeholder=\"Describe the sound you want\"], textarea[placeholder*=\"クラシック音楽\"], textarea[placeholder*=\"バイキングメタル\"], textarea[placeholder*=\"sound you want\"]",
      value: "cold synth texture"
    });
    expect(page.fills).toContainEqual({
      selector: "input[placeholder=\"Exclude styles\"]",
      value: "generic edm drop"
    });
    expect(page.clicks).not.toContain("button[aria-label=\"Create song\"]");
    expect(context.close).toHaveBeenCalledTimes(1);
  });

  it("clicks the instrumental toggle when requested and still skips submit", async () => {
    const { page, context } = createContext();
    launchPersistentContextMock.mockResolvedValue(context);
    const driver = new PlaywrightSunoDriver(".openclaw-browser-profiles/suno", "skip");

    const result = await driver.create({
      dryRun: false,
      authority: "auto_create_and_select_take",
      runId: "run-002",
      payload: {
        styleAndFeel: "drone folk",
        instrumental: true
      }
    });

    expect(result.reason).toBe(PLAYWRIGHT_CREATE_SKIPPED_REASON);
    expect(page.clicks).toContain("button[aria-label=\"Check this to generate an instrumental only song\"]");
    expect(page.clicks).not.toContain("button[aria-label=\"Create song\"]");
  });

  it("rejects live submit mode in round 39 without clicking Create", async () => {
    const { page, context } = createContext();
    launchPersistentContextMock.mockResolvedValue(context);
    const driver = new PlaywrightSunoDriver(".openclaw-browser-profiles/suno", "live");

    const result = await driver.create({
      dryRun: false,
      authority: "auto_create_and_select_take",
      runId: "run-003",
      payload: {
        lyrics: "line one"
      }
    });

    expect(result.reason).toBe(PLAYWRIGHT_CREATE_LIVE_DISABLED_REASON);
    expect(page.clicks).not.toContain("button[aria-label=\"Create song\"]");
  });

  it("fails closed when Playwright launch raises an error", async () => {
    launchPersistentContextMock.mockRejectedValue(new Error("browser launch failed"));
    const driver = new PlaywrightSunoDriver(".openclaw-browser-profiles/suno", "skip");

    const result = await driver.create({
      dryRun: false,
      authority: "auto_create_and_select_take",
      runId: "run-004",
      payload: {}
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toContain("playwright_create_failed: browser launch failed");
  });
});
