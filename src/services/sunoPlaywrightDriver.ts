import { mkdir } from "node:fs/promises";
import type { SunoCreateRequest, SunoCreateResult, SunoImportRequest, SunoImportResult } from "../types.js";
import type { SunoBrowserDriver, SunoBrowserDriverProbe } from "./sunoBrowserWorker.js";
import type { BrowserContext, Page } from "playwright";

export const DEFAULT_SUNO_PROFILE_PATH = ".openclaw-browser-profiles/suno";
export const SUNO_CREATE_URL = "https://suno.com/create";
export const PLAYWRIGHT_DRIVER_NOT_INSTALLED_DETAIL =
  "playwright module not installed — run `npm install` in project root";
export const PLAYWRIGHT_DRIVER_LOGIN_REQUIRED_DETAIL =
  "Suno login required in persistent profile — run `scripts/openclaw-suno-login.sh` and complete operator login";

/**
 * Round 38 adds probe automation.
 * Round 39 adds create/import automation, and Round 40 adds audio download
 * flow. Each step still requires explicit GO.
 */
export class PlaywrightSunoDriver implements SunoBrowserDriver {
  constructor(readonly profilePath: string) {}

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
    return {
      accepted: false,
      runId: request.runId ?? "playwright-driver-stub",
      reason: "playwright_driver_skeleton_only",
      urls: [],
      dryRun: request.dryRun
    };
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

  private isModuleNotInstalled(error: unknown): boolean {
    const message = this.errorMessage(error);
    return message.includes("Cannot find package 'playwright'") || message.includes("Cannot find module 'playwright'");
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
