import type { IncomingMessage, ServerResponse } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { beforeEach, describe, expect, it } from "vitest";
import { buildStatusResponse, registerRoutes } from "../src/routes";
import { resetAutopilotTickerForTest, AutopilotTicker } from "../src/services/autopilotTicker";
import { ensureArtistWorkspace } from "../src/services/artistWorkspace";
import { patchResolvedConfig } from "../src/services/runtimeConfig";
import { createSongIdea } from "../src/services/songIdeation";
import { SunoBrowserWorker } from "../src/services/sunoBrowserWorker";

function createMockRequest(method: string, url: string, body?: string, headers?: Record<string, string>): IncomingMessage {
  const req = Readable.from(body ? [body] : []) as IncomingMessage;
  req.method = method;
  req.url = url;
  req.headers = headers ?? {};
  return req;
}

function createMockResponse() {
  let body = "";
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 200,
    headersSent: false,
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
      return this;
    },
    end(chunk?: string | Buffer) {
      if (chunk) {
        body += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk;
      }
      this.headersSent = true;
      return this;
    }
  } as unknown as ServerResponse;

  return {
    res,
    readBody: () => body,
    readHeader: (name: string) => headers[name.toLowerCase()],
    readStatus: () => (res as unknown as { statusCode: number }).statusCode
  };
}

describe("status ticker and reply simulation routes", () => {
  beforeEach(() => {
    resetAutopilotTickerForTest();
  });

  it("surfaces autopilot ticker info in /api/status", async () => {
    const root = mkdtempSync(join(tmpdir(), "artist-runtime-status-ticker-"));
    await ensureArtistWorkspace(root);
    const ticker = new AutopilotTicker();

    await ticker.tick({
      artist: { workspaceRoot: root },
      autopilot: { enabled: true, dryRun: true, cycleIntervalMinutes: 2 }
    });

    const status = await buildStatusResponse({
      artist: { workspaceRoot: root },
      autopilot: { cycleIntervalMinutes: 2 }
    });

    expect(status.ticker.lastOutcome).toBe("ran");
    expect(status.ticker.lastTickAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(status.ticker.intervalMs).toBe(120000);
  });

  it("reads persisted config overrides into /api/status", async () => {
    const root = mkdtempSync(join(tmpdir(), "artist-runtime-status-config-"));
    await ensureArtistWorkspace(root);
    await patchResolvedConfig(root, {
      artist: { workspaceRoot: root },
      autopilot: { enabled: true, dryRun: false, songsPerWeek: 6, cycleIntervalMinutes: 15 },
      distribution: {
        enabled: true,
        liveGoArmed: false,
        platforms: {
          x: { enabled: true, liveGoArmed: true }
        }
      }
    });

    const status = await buildStatusResponse({
      artist: { workspaceRoot: root }
    });

    expect(status.autopilot.enabled).toBe(true);
    expect(status.config.autopilot.songsPerWeek).toBe(6);
    expect(status.config.autopilot.cycleIntervalMinutes).toBe(15);
    expect(status.config.autopilot.dryRun).toBe(false);
    expect(status.config.distribution.liveGoArmed).toBe(false);
    expect(status.config.distribution.platforms.x.enabled).toBe(true);
    expect(status.config.distribution.platforms.x.liveGoArmed).toBe(true);
    expect(status.ticker.intervalMs).toBe(900000);
    expect(status.distributionWorker.liveGoArmed).toBe(false);
    expect(status.distributionWorker.platformLiveGoArmed).toMatchObject({
      x: true,
      instagram: false,
      tiktok: false
    });
    expect(status.distributionWorker.effectiveDryRun).toMatchObject({
      x: true,
      instagram: true,
      tiktok: true
    });
    expect(status.distributionWorker.blockedReason).toContain("live-go arm");
    expect(status.platforms.x.liveGoArmed).toBe(true);
    expect(status.platforms.x.effectiveDryRun).toBe(true);
    expect(status.platforms.instagram.liveGoArmed).toBe(false);
    expect(status.platforms.instagram.effectiveDryRun).toBe(true);
  });

  it("updates ticker getters when /api/run-cycle is triggered", async () => {
    const root = mkdtempSync(join(tmpdir(), "artist-runtime-run-cycle-ticker-"));
    await ensureArtistWorkspace(root);
    await patchResolvedConfig(root, {
      artist: { workspaceRoot: root },
      autopilot: { enabled: true, dryRun: true }
    });

    const registered = new Map<string, (req: IncomingMessage, res: ServerResponse) => Promise<boolean | void> | boolean | void>();
    registerRoutes({
      registerHttpRoute(definition: { path: string; handler: (req: IncomingMessage, res: ServerResponse) => Promise<boolean | void> | boolean | void }) {
        registered.set(definition.path, definition.handler);
      }
    });

    const handler = registered.get("/plugins/artist-runtime/api/run-cycle");
    expect(handler).toBeTruthy();

    const response = createMockResponse();
    await handler?.(
      createMockRequest(
        "POST",
        "/plugins/artist-runtime/api/run-cycle",
        JSON.stringify({
          config: { artist: { workspaceRoot: root } }
        }),
        { "content-type": "application/json" }
      ),
      response.res
    );

    expect(response.readStatus()).toBe(200);
    expect(JSON.parse(response.readBody())).toMatchObject({
      tickerOutcome: "ran"
    });

    const status = await buildStatusResponse({
      artist: { workspaceRoot: root }
    });
    expect(status.ticker.lastOutcome).toBe("ran");
    expect(status.ticker.lastTickAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("registers a dry-run simulate-reply route and keeps replies blocked", async () => {
    const root = mkdtempSync(join(tmpdir(), "artist-runtime-simulate-reply-"));
    await ensureArtistWorkspace(root);
    const created = await createSongIdea({ workspaceRoot: root, artistReason: "cold relay signal" });

    const registered = new Map<string, (req: IncomingMessage, res: ServerResponse) => Promise<boolean | void> | boolean | void>();
    registerRoutes({
      registerHttpRoute(definition: { path: string; handler: (req: IncomingMessage, res: ServerResponse) => Promise<boolean | void> | boolean | void }) {
        registered.set(definition.path, definition.handler);
      }
    });

    const handler = registered.get("/plugins/artist-runtime/api/platforms");
    expect(handler).toBeTruthy();

    const response = createMockResponse();
    await handler?.(
      createMockRequest(
        "POST",
        "/plugins/artist-runtime/api/platforms/x/simulate-reply",
        JSON.stringify({
          config: { artist: { workspaceRoot: root } },
          songId: created.songId,
          targetId: "1900000000000000000",
          text: "dry-run reply only"
        }),
        { "content-type": "application/json" }
      ),
      response.res
    );

    expect(response.readStatus()).toBe(200);
    expect(response.readHeader("content-type")).toContain("application/json");
    expect(JSON.parse(response.readBody())).toMatchObject({
      result: {
        accepted: false,
        dryRun: true,
        reason: "dry-run blocks social publish"
      },
      entry: {
        action: "reply",
        songId: created.songId,
        dryRun: true
      }
    });
  });

  it("surfaces imported paths and metadata through /api/status", async () => {
    const root = mkdtempSync(join(tmpdir(), "artist-runtime-status-import-meta-"));
    await ensureArtistWorkspace(root);
    const worker = new SunoBrowserWorker(root);

    await worker.start({
      driver: {
        async probe() {
          return { state: "connected" as const };
        },
        async importResults({ runId, urls }) {
          return {
            accepted: true,
            runId,
            urls,
            paths: [`${root}/runtime/suno/${runId}/song-1.mp3`],
            metadata: [
              {
                url: urls[0],
                path: `${root}/runtime/suno/${runId}/song-1.mp3`,
                title: "Recovered Track",
                durationSec: 187,
                format: "mp3" as const
              }
            ],
            importedAt: "2026-04-22T00:00:00.000Z",
            reason: "imported"
          };
        }
      }
    });
    await worker.importRun("run-status-meta", ["https://suno.com/song/song-1"], {
      driver: {
        async probe() {
          return { state: "connected" as const };
        },
        async importResults({ runId, urls }) {
          return {
            accepted: true,
            runId,
            urls,
            paths: [`${root}/runtime/suno/${runId}/song-1.mp3`],
            metadata: [
              {
                url: urls[0],
                path: `${root}/runtime/suno/${runId}/song-1.mp3`,
                title: "Recovered Track",
                durationSec: 187,
                format: "mp3" as const
              }
            ],
            importedAt: "2026-04-22T00:00:00.000Z",
            reason: "imported"
          };
        }
      }
    });

    const status = await buildStatusResponse({
      artist: { workspaceRoot: root }
    });

    expect(status.sunoWorker.lastImportOutcome).toMatchObject({
      runId: "run-status-meta",
      urlCount: 1,
      pathCount: 1,
      paths: [`${root}/runtime/suno/run-status-meta/song-1.mp3`],
      metadata: [
        {
          url: "https://suno.com/song/song-1",
          path: `${root}/runtime/suno/run-status-meta/song-1.mp3`,
          title: "Recovered Track",
          durationSec: 187,
          format: "mp3"
        }
      ]
    });
  });
});
