import type { SunoPromptPack, SunoRun } from "../types/suno.js";

export class SunoBrowserWorker {
  constructor(private readonly browserProfilePath: string) {}

  async connect(): Promise<{ ok: boolean; message: string }> {
    // TODO: open persistent Suno browser profile and wait for human login.
    return { ok: false, message: "TODO implement Suno browser connect flow" };
  }

  async generate(pack: SunoPromptPack): Promise<SunoRun> {
    // TODO:
    // 1. verify login
    // 2. open create page
    // 3. fill fields
    // 4. verify fields
    // 5. click Create if policy permits
    // 6. import URLs/takes
    // 7. stop on hard stops
    return {
      runId: `suno_run_${Date.now()}`,
      songId: pack.songId,
      payloadHash: "TODO",
      status: "prepared",
      createdAt: new Date().toISOString(),
      resultUrls: [],
    };
  }
}