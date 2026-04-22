import type { SunoCreateRequest, SunoCreateResult, SunoImportRequest, SunoImportResult } from "../types.js";
import type { SunoBrowserDriver, SunoBrowserDriverProbe } from "./sunoBrowserWorker.js";

export const PLAYWRIGHT_DRIVER_STUB_DETAIL =
  "playwright driver skeleton only — install playwright in operator machine (`npm install playwright`) and enable via config to use";

/**
 * Round 37 skeleton only.
 * Round 38 adds probe automation, Round 39 adds create/import automation,
 * and Round 40 adds audio download flow. Each step still requires explicit GO.
 */
export class PlaywrightSunoDriver implements SunoBrowserDriver {
  constructor(readonly profilePath: string) {}

  async probe(): Promise<SunoBrowserDriverProbe> {
    return {
      state: "disconnected",
      detail: PLAYWRIGHT_DRIVER_STUB_DETAIL
    };
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
}
