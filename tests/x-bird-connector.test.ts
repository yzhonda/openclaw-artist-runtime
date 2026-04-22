import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { XBirdConnector } from "../src/connectors/social/xBirdConnector";

interface SpawnStep {
  code?: number | null;
  stdout?: string;
  stderr?: string;
  errorCode?: string;
}

class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
}

function createSpawnMock(steps: SpawnStep[]) {
  let index = 0;
  return (() => {
    const step = steps[index++];
    const child = new FakeChildProcess();

    queueMicrotask(() => {
      if (!step) {
        child.emit("close", 1);
        return;
      }
      if (step.errorCode) {
        const error = new Error(step.errorCode) as NodeJS.ErrnoException;
        error.code = step.errorCode;
        child.emit("error", error);
        return;
      }
      if (step.stdout) {
        child.stdout.emit("data", step.stdout);
      }
      if (step.stderr) {
        child.stderr.emit("data", step.stderr);
      }
      child.emit("close", step.code ?? 0);
    });

    return child;
  }) as unknown as typeof import("node:child_process").spawn;
}

describe("XBirdConnector.checkConnection", () => {
  it("fails closed when bird CLI is not installed", async () => {
    const connector = new XBirdConnector(
      createSpawnMock([{ errorCode: "ENOENT" }])
    );

    await expect(connector.checkConnection()).resolves.toEqual({
      connected: false,
      reason: "bird_cli_not_installed"
    });
  });

  it("returns auth expired when bird whoami reports 401-style auth failure", async () => {
    const connector = new XBirdConnector(
      createSpawnMock([
        { code: 0, stdout: "bird help" },
        { code: 1, stderr: "401 Unauthorized: Could not authenticate" }
      ])
    );

    await expect(connector.checkConnection()).resolves.toEqual({
      connected: false,
      reason: "bird_auth_expired"
    });
  });

  it("returns connected with account label when bird whoami succeeds", async () => {
    const connector = new XBirdConnector(
      createSpawnMock([
        { code: 0, stdout: "bird help" },
        { code: 0, stdout: "@ghost_station" }
      ])
    );

    await expect(connector.checkConnection()).resolves.toEqual({
      connected: true,
      accountLabel: "@ghost_station"
    });
  });
});

describe("XBirdConnector.publish", () => {
  it("keeps dry-run publishes blocked", async () => {
    const connector = new XBirdConnector(createSpawnMock([]));

    await expect(
      connector.publish({
        dryRun: true,
        authority: "auto_publish",
        postType: "observation",
        text: "ghost station"
      })
    ).resolves.toEqual({
      accepted: false,
      platform: "x",
      dryRun: true,
      reason: "dry-run blocks publish"
    });
  });

  it("publishes text-only tweets and parses the returned URL", async () => {
    const connector = new XBirdConnector(
      createSpawnMock([
        {
          code: 0,
          stdout: "posted https://x.com/ghost_station/status/1234567890123456789"
        }
      ]),
      {
        now: () => 1000,
        publishGuardState: { recentPublishes: [] },
        minPublishIntervalMs: 100
      }
    );

    await expect(
      connector.publish({
        dryRun: false,
        authority: "auto_publish",
        postType: "observation",
        text: "signal under frost"
      })
    ).resolves.toEqual({
      accepted: true,
      platform: "x",
      dryRun: false,
      reason: "bird_publish_ok",
      id: "1234567890123456789",
      url: "https://x.com/ghost_station/status/1234567890123456789",
      raw: "posted https://x.com/ghost_station/status/1234567890123456789"
    });
  });

  it("returns auth expired when tweet publish reports auth failure", async () => {
    const connector = new XBirdConnector(
      createSpawnMock([
        {
          code: 1,
          stderr: "401 Unauthorized: Could not authenticate"
        }
      ]),
      {
        publishGuardState: { recentPublishes: [] }
      }
    );

    await expect(
      connector.publish({
        dryRun: false,
        authority: "auto_publish",
        postType: "observation",
        text: "night transit residue"
      })
    ).resolves.toEqual({
      accepted: false,
      platform: "x",
      dryRun: false,
      reason: "bird_auth_expired"
    });
  });

  it("blocks duplicate text hashes before invoking bird", async () => {
    const guardState = {
      recentPublishes: [
        {
          textHash: "450fb100011db77e4b2234e3fa3eb4193c0f6241c057e6cd57d130f273a8ea7e",
          publishedAtMs: 1000
        }
      ]
    };
    const connector = new XBirdConnector(
      createSpawnMock([]),
      {
        now: () => 2000,
        publishGuardState: guardState,
        minPublishIntervalMs: 100
      }
    );

    await expect(
      connector.publish({
        dryRun: false,
        authority: "auto_publish",
        postType: "observation",
        text: "same old static"
      })
    ).resolves.toEqual({
      accepted: false,
      platform: "x",
      dryRun: false,
      reason: "bird_duplicate_text_blocked"
    });
  });

  it("blocks posts inside the minimum publish interval", async () => {
    const connector = new XBirdConnector(
      createSpawnMock([]),
      {
        now: () => 1200,
        publishGuardState: {
          recentPublishes: [
            {
              textHash: "different-hash",
              publishedAtMs: 1000
            }
          ]
        },
        minPublishIntervalMs: 500
      }
    );

    await expect(
      connector.publish({
        dryRun: false,
        authority: "auto_publish",
        postType: "observation",
        text: "fresh words, too soon"
      })
    ).resolves.toEqual({
      accepted: false,
      platform: "x",
      dryRun: false,
      reason: "bird_min_interval_blocked"
    });
  });
});
