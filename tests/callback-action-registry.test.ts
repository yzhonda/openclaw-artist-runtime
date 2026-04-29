import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  defaultCallbackActionExpiresAt,
  markCallbackResolved,
  readCallbackActionEntries,
  registerCallbackAction,
  resolveCallbackAction
} from "../src/services/callbackActionRegistry";

function root(): string {
  return mkdtempSync(join(tmpdir(), "artist-runtime-callback-registry-"));
}

describe("callback action registry", () => {
  it("registers and resolves pending callback actions", async () => {
    const workspace = root();

    const entry = await registerCallbackAction(workspace, {
      action: "proposal_yes",
      proposalId: "proposal-1",
      chatId: 123,
      messageId: 456,
      userId: 789,
      now: 1000
    });

    expect(entry.callbackId).toMatch(/^[A-Za-z0-9]{8,12}$/);
    expect(entry.expiresAt).toBe(defaultCallbackActionExpiresAt(1000));
    await expect(resolveCallbackAction(workspace, entry.callbackId)).resolves.toMatchObject({
      callbackId: entry.callbackId,
      action: "proposal_yes",
      status: "pending"
    });
  });

  it("marks resolved entries through append-only updates", async () => {
    const workspace = root();
    const entry = await registerCallbackAction(workspace, {
      action: "proposal_no",
      chatId: 1,
      messageId: 2,
      userId: 3,
      now: 100
    });

    await markCallbackResolved(workspace, entry.callbackId, { status: "discarded", reason: "operator_no", now: 200 });

    const resolved = await resolveCallbackAction(workspace, entry.callbackId);
    const entries = await readCallbackActionEntries(workspace);
    expect(resolved).toMatchObject({ status: "discarded", resolvedAt: 200, resolveReason: "operator_no" });
    expect(entries).toHaveLength(2);
  });

  it("generates unique short ids for multiple registrations", async () => {
    const workspace = root();
    const ids = new Set<string>();
    for (let index = 0; index < 25; index += 1) {
      const entry = await registerCallbackAction(workspace, {
        action: "proposal_yes",
        chatId: 1,
        messageId: index,
        userId: 2
      });
      ids.add(entry.callbackId);
    }

    expect(ids.size).toBe(25);
  });
});
