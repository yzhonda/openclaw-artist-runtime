import { mkdtempSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { collectObservations } from "../src/services/xObservationCollector";

describe("x observation URL capture", () => {
  it("stores observation text with author, URL, and posted time when bird output includes them", async () => {
    const root = mkdtempSync(join(tmpdir(), "artist-runtime-x-url-capture-"));
    const result = await collectObservations(root, {
      now: new Date("2026-05-01T00:00:00.000Z"),
      personaText: "redevelopment city",
      runner: async () => ({
        stdout: "@city_watcher redevelopment closed another small venue https://x.com/city_watcher/status/1234567890 2026-05-01T15:00:00.000Z"
      })
    });

    const written = await readFile(result.path, "utf8");
    expect(result.status).toBe("collected");
    expect(written).toContain("- text: \"@city_watcher redevelopment closed another small venue\"");
    expect(written).toContain("author: \"city_watcher\"");
    expect(written).toContain("url: \"https://x.com/city_watcher/status/1234567890\"");
    expect(written).toContain("postedAt: \"2026-05-01T15:00:00.000Z\"");
  });
});
