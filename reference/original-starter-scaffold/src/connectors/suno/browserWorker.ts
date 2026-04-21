import type { SunoConnector } from "./SunoConnector.js";
import type { SunoPromptPack, SunoRun } from "../../types/suno.js";
import { SunoBrowserWorker } from "../../services/sunoBrowserWorker.js";

export class BrowserWorkerSunoConnector implements SunoConnector {
  id = "background_browser_worker";
  constructor(private readonly worker: SunoBrowserWorker) {}

  checkConnection() {
    return this.worker.connect();
  }

  generate(pack: SunoPromptPack): Promise<SunoRun> {
    return this.worker.generate(pack);
  }
}