import type { SunoCreateRequest, SunoCreateResult, SunoImportResult } from "../../types.js";
import { SunoBrowserWorker } from "../../services/sunoBrowserWorker.js";
import type { SunoConnector } from "./SunoConnector.js";

export class BrowserWorkerSunoConnector implements SunoConnector {
  constructor(private readonly workspaceRoot = ".", private readonly worker = new SunoBrowserWorker(workspaceRoot)) {}

  async status() {
    return this.worker.status();
  }

  async create(input: SunoCreateRequest): Promise<SunoCreateResult> {
    return {
      accepted: false,
      runId: `dry_${Date.now().toString(36)}`,
      reason: input.dryRun ? "dry-run blocks Suno create" : "Suno browser worker is not enabled in this environment",
      urls: []
    };
  }

  async importResults(_input: { runId: string }): Promise<SunoImportResult> {
    return { urls: [] };
  }
}
