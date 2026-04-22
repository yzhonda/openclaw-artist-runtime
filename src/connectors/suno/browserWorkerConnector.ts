import type { SunoCreateRequest, SunoCreateResult, SunoImportResult } from "../../types.js";
import { SunoBrowserWorker } from "../../services/sunoBrowserWorker.js";
import type { SunoConnector } from "./SunoConnector.js";

type WorkerMethods = Pick<SunoBrowserWorker, "status" | "startCreate" | "importRun">;

export class BrowserWorkerSunoConnector implements SunoConnector {
  constructor(private readonly workspaceRoot = ".", private readonly worker: WorkerMethods = new SunoBrowserWorker(workspaceRoot)) {}

  async status() {
    return this.worker.status();
  }

  async create(input: SunoCreateRequest): Promise<SunoCreateResult> {
    return this.worker.startCreate(input, { dryRun: input.dryRun });
  }

  async importResults(input: { runId: string }): Promise<SunoImportResult> {
    return this.worker.importRun(input.runId);
  }
}
