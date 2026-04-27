import { describe, expect, it } from "vitest";
import { routeTelegramCommand } from "../src/services/telegramCommandRouter";

const baseInput = {
  fromUserId: 123,
  chatId: 456
};

describe("telegram command router", () => {
  it("routes /help to the skeleton help response", () => {
    const result = routeTelegramCommand({ ...baseInput, text: "/help" });

    expect(result.kind).toBe("help");
    expect(result.responseText).toContain("/status");
    expect(result.shouldStoreFreeText).toBe(false);
  });

  it("routes /status without invoking autopilot controls", () => {
    const result = routeTelegramCommand({ ...baseInput, text: "/status" });

    expect(result.kind).toBe("status");
    expect(result.responseText).toContain("Phase 3");
    expect(result.shouldStoreFreeText).toBe(false);
  });

  it("returns a safe response for unknown commands", () => {
    const result = routeTelegramCommand({ ...baseInput, text: "/regen song-001" });

    expect(result.kind).toBe("unknown");
    expect(result.responseText).toContain("Unknown command");
    expect(result.shouldStoreFreeText).toBe(false);
  });

  it("stages free-text for the future inbox path", () => {
    const result = routeTelegramCommand({ ...baseInput, text: "please make the next hook colder" });

    expect(result.kind).toBe("free_text");
    expect(result.responseText).toContain("disabled until Phase 3");
    expect(result.shouldStoreFreeText).toBe(true);
  });
});
