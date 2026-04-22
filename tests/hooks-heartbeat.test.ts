import { describe, expect, it } from "vitest";
import { registerHooks } from "../src/hooks/index.js";

describe("registerHooks — lifecycle skeleton", () => {
  it("registers all expected events including gateway lifecycle anchors", () => {
    const registered: string[] = [];
    const api = {
      registerHook: (events: string | string[]) => {
        const names = Array.isArray(events) ? events : [events];
        registered.push(...names);
      }
    };

    registerHooks(api);

    expect(registered).toContain("agent:bootstrap");
    expect(registered).toContain("before_tool_call");
    expect(registered).toContain("after_tool_call");
    expect(registered).toContain("gateway_start");
    expect(registered).toContain("gateway_stop");
  });

  it("is a no-op when api does not implement registerHook", () => {
    expect(() => registerHooks({})).not.toThrow();
  });

  it("gateway_start / gateway_stop skeleton handlers return status payload", async () => {
    const handlers = new Map<string, (payload?: unknown) => unknown | Promise<unknown>>();
    const api = {
      registerHook: (events: string | string[], handler: (payload?: unknown) => unknown | Promise<unknown>) => {
        const names = Array.isArray(events) ? events : [events];
        for (const name of names) {
          handlers.set(name, handler);
        }
      }
    };

    registerHooks(api);

    const startHandler = handlers.get("gateway_start");
    const stopHandler = handlers.get("gateway_stop");
    expect(startHandler).toBeDefined();
    expect(stopHandler).toBeDefined();

    expect(await startHandler?.()).toEqual({ status: "artist-runtime:ready" });
    expect(await stopHandler?.()).toEqual({ status: "artist-runtime:stopped" });
  });
});
