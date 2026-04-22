import { mkdir } from "node:fs/promises";
import type { SunoCreateRequest, SunoCreateResult, SunoImportRequest, SunoImportResult, SunoSubmitMode } from "../types.js";
import type { SunoBrowserDriver, SunoBrowserDriverProbe } from "./sunoBrowserWorker.js";
import type { BrowserContext, Page } from "playwright";

export const DEFAULT_SUNO_PROFILE_PATH = ".openclaw-browser-profiles/suno";
export const SUNO_CREATE_URL = "https://suno.com/create";
export const SUNO_LIBRARY_URL = "https://suno.com/me";
export const PLAYWRIGHT_DRIVER_NOT_INSTALLED_DETAIL =
  "playwright module not installed — run `npm install` in project root";
export const PLAYWRIGHT_DRIVER_LOGIN_REQUIRED_DETAIL =
  "Suno login required in persistent profile — run `scripts/openclaw-suno-login.sh` and complete operator login";
export const PLAYWRIGHT_CREATE_SKIPPED_REASON = "submit_skipped";
export const PLAYWRIGHT_LIVE_TIMEOUT_REASON = "playwright_live_timeout";
export const PLAYWRIGHT_POLL_INTERVAL_MS = 3_000;
export const PLAYWRIGHT_POLL_TIMEOUT_MS = 10 * 60 * 1_000;

/**
 * Round 38 adds probe automation.
 * Round 39 adds create/import automation, and Round 40 adds audio download
 * flow. Each step still requires explicit GO.
 */
export class PlaywrightSunoDriver implements SunoBrowserDriver {
  constructor(
    readonly profilePath: string,
    readonly submitMode: SunoSubmitMode = "skip",
    private readonly polling = {
      intervalMs: PLAYWRIGHT_POLL_INTERVAL_MS,
      timeoutMs: PLAYWRIGHT_POLL_TIMEOUT_MS
    }
  ) {}

  async probe(): Promise<SunoBrowserDriverProbe> {
    let context: BrowserContext | undefined;

    try {
      const { chromium } = await import("playwright-extra");
      const stealth = (await import("puppeteer-extra-plugin-stealth")).default;
      chromium.use(stealth());
      await mkdir(this.profilePath, { recursive: true });
      context = await chromium.launchPersistentContext(this.profilePath, {
        headless: false,
        channel: "chrome",
        args: ["--disable-blink-features=AutomationControlled"],
        ignoreDefaultArgs: ["--enable-automation"]
      });

      const page = context.pages()[0] ?? await context.newPage();
      await page.goto(SUNO_CREATE_URL, {
        waitUntil: "domcontentloaded",
        timeout: 20_000
      });
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);

      const url = page.url();
      if (await this.isLoginRequired(page, url)) {
        return {
          state: "login_required",
          detail: PLAYWRIGHT_DRIVER_LOGIN_REQUIRED_DETAIL
        };
      }

      if (await this.isConnected(page, url)) {
        return {
          state: "connected",
          detail: `Suno session detected in ${this.profilePath}`
        };
      }

      return {
        state: "disconnected",
        detail: `Suno probe could not confirm login state at ${url}`
      };
    } catch (error) {
      if (this.isModuleNotInstalled(error)) {
        return {
          state: "disconnected",
          detail: PLAYWRIGHT_DRIVER_NOT_INSTALLED_DETAIL
        };
      }

      return {
        state: "disconnected",
        detail: `playwright probe failed: ${this.errorMessage(error)}`
      };
    } finally {
      await context?.close().catch(() => undefined);
    }
  }

  async create(request: SunoCreateRequest): Promise<SunoCreateResult> {
    let context: BrowserContext | undefined;
    const runId = request.runId ?? `playwright_${Date.now().toString(36)}`;

    try {
      const { chromium } = await import("playwright-extra");
      const stealth = (await import("puppeteer-extra-plugin-stealth")).default;
      chromium.use(stealth());
      await mkdir(this.profilePath, { recursive: true });
      context = await chromium.launchPersistentContext(this.profilePath, {
        headless: false,
        channel: "chrome",
        args: ["--disable-blink-features=AutomationControlled"],
        ignoreDefaultArgs: ["--enable-automation"]
      });

      const page = context.pages()[0] ?? await context.newPage();
      const baselineUrls = new Set(await this.readSongUrls(page));
      await page.goto(SUNO_CREATE_URL, {
        waitUntil: "domcontentloaded",
        timeout: 20_000
      });
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);

      const payload = request.payload ?? {};
      const lyrics = this.readPayloadText(payload.lyrics);
      const style = this.readPayloadText(payload.styleAndFeel);
      const exclude = this.readPayloadText(payload.excludeStyles);
      const instrumental = Boolean(payload.instrumental);

      await this.fillCreateForm(page, { lyrics, style, exclude, instrumental });

      if (this.submitMode === "skip") {
        return {
          accepted: false,
          runId,
          reason: PLAYWRIGHT_CREATE_SKIPPED_REASON,
          urls: [],
          dryRun: request.dryRun
        };
      }

      await page.locator("button[aria-label=\"Create song\"]").click();
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      const urls = await this.pollForGeneratedSongs(page, baselineUrls);
      if (urls.length > 0) {
        return {
          accepted: true,
          runId,
          reason: "submitted",
          urls,
          dryRun: request.dryRun
        };
      }

      return {
        accepted: false,
        runId,
        reason: PLAYWRIGHT_LIVE_TIMEOUT_REASON,
        urls: [],
        dryRun: request.dryRun
      };
    } catch (error) {
      if (this.isModuleNotInstalled(error)) {
        return {
          accepted: false,
          runId,
          reason: PLAYWRIGHT_DRIVER_NOT_INSTALLED_DETAIL,
          urls: [],
          dryRun: request.dryRun
        };
      }

      return {
        accepted: false,
        runId,
        reason: `playwright_create_failed: ${this.errorMessage(error)}`,
        urls: [],
        dryRun: request.dryRun
      };
    } finally {
      await context?.close().catch(() => undefined);
    }
  }

  async importResults(request: SunoImportRequest): Promise<SunoImportResult> {
    return {
      runId: request.runId,
      urls: [],
      reason: "playwright_driver_skeleton_only",
      dryRun: false
    };
  }

  private async isLoginRequired(page: Page, currentUrl: string): Promise<boolean> {
    if (/(sign[-_ ]?in|login|auth)/i.test(currentUrl)) {
      return true;
    }

    const loginSelectors = [
      "input[type='password']",
      "input[name='password']",
      "form[action*='login']",
      "form[action*='sign']"
    ];
    for (const selector of loginSelectors) {
      if (await page.locator(selector).count().catch(() => 0)) {
        return true;
      }
    }

    return false;
  }

  private async isConnected(page: Page, currentUrl: string): Promise<boolean> {
    if (/^https:\/\/suno\.com\/(create|library|me|explore|$)/.test(currentUrl)) {
      return true;
    }

    const connectedSelectors = [
      "[data-testid*='avatar']",
      "[aria-label*='Account']",
      "a[href='/create']",
      "a[href='/library']"
    ];
    for (const selector of connectedSelectors) {
      if (await page.locator(selector).count().catch(() => 0)) {
        return true;
      }
    }

    return false;
  }

  private readPayloadText(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value : undefined;
  }

  private async fillCreateForm(
    page: Page,
    input: {
      lyrics?: string;
      style?: string;
      exclude?: string;
      instrumental: boolean;
    }
  ): Promise<void> {
    if (input.lyrics) {
      await this.ensureLyricsMode(page);
      await page.locator("textarea[data-testid=\"lyrics-textarea\"]").fill(input.lyrics);
    }

    if (input.style) {
      await this.styleLocator(page).fill(input.style);
    }

    if (input.exclude) {
      await page.locator("input[placeholder=\"Exclude styles\"]").fill(input.exclude);
    }

    if (input.instrumental) {
      const button = page.locator("button[aria-label=\"Check this to generate an instrumental only song\"]");
      const pressed = await button.getAttribute("aria-pressed").catch(() => null);
      if (pressed !== "true") {
        await button.click();
      }
    }
  }

  private async ensureLyricsMode(page: Page): Promise<void> {
    const textarea = page.locator("textarea[data-testid=\"lyrics-textarea\"]");
    if (await textarea.count().catch(() => 0)) {
      return;
    }
    await page.locator("button[aria-label=\"Add your own lyrics\"]").click();
  }

  private styleLocator(page: Page) {
    return page.locator(
      "[data-testid=\"create-form-styles-wrapper\"] textarea, textarea[placeholder=\"Describe the sound you want\"], textarea[placeholder*=\"クラシック音楽\"], textarea[placeholder*=\"バイキングメタル\"], textarea[placeholder*=\"sound you want\"]"
    ).first();
  }

  private async readSongUrls(page: Page): Promise<string[]> {
    await page.goto(SUNO_LIBRARY_URL, {
      waitUntil: "domcontentloaded",
      timeout: 20_000
    });
    await page.waitForLoadState("domcontentloaded").catch(() => undefined);
    return page.evaluate(() => Array.from(document.querySelectorAll("a[href*='/song/']"))
      .map((element) => (element as HTMLAnchorElement).href)
      .filter((href) => href.startsWith("https://suno.com/song/")));
  }

  private async pollForGeneratedSongs(page: Page, baselineUrls: Set<string>): Promise<string[]> {
    const maxAttempts = Math.max(1, Math.ceil(this.polling.timeoutMs / this.polling.intervalMs));
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const currentUrls = await this.readSongUrls(page);
      const newUrls = currentUrls.filter((url) => !baselineUrls.has(url));
      if (newUrls.length > 0) {
        return newUrls;
      }
      if (attempt < maxAttempts - 1) {
        await page.waitForTimeout(this.polling.intervalMs);
      }
    }
    return [];
  }

  private isModuleNotInstalled(error: unknown): boolean {
    const message = this.errorMessage(error);
    return message.includes("Cannot find package 'playwright'") || message.includes("Cannot find module 'playwright'");
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
