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
