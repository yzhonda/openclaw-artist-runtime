import type { IncomingMessage, ServerResponse } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { beforeEach, describe, expect, it } from "vitest";
import { buildStatusResponse, registerRoutes } from "../src/routes";
import { resetAutopilotTickerForTest, AutopilotTicker } from "../src/services/autopilotTicker";
import { ensureArtistWorkspace } from "../src/services/artistWorkspace";
import { createSongIdea } from "../src/services/songIdeation";

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

    const handler = registered.get("/plugins/artist-runtime/api/platforms/x/simulate-reply");
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
});
