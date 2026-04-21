import { mkdtempSync } from "node:fs";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createSunoPromptPack } from "../src/suno-production/generatePromptPack";
import { createAndPersistSunoPromptPack } from "../src/services/sunoPromptPackFiles";
import { validateSunoPromptPack } from "../src/validators/promptPackValidator";
import { registerHooks } from "../src/hooks";
import { buildStatusResponse, registerRoutes } from "../src/routes";
import { registerServices } from "../src/services";
import { registerTools } from "../src/tools";

describe("prompt pack", () => {
  it("builds a valid prompt pack", () => {
    const pack = createSunoPromptPack({
      songId: "song-001",
      songTitle: "Ghost Station",
      artistReason: "night transit residue",
      lyricsText: "駅の光だけが\nまだ私を覚えている",
      artistSnapshot: "# ARTIST\n",
      currentStateSnapshot: "# CURRENT_STATE\nQuiet.",
      knowledgePackVersion: "test-pack"
    });

    expect(pack.validation.valid).toBe(true);
    expect(pack.payloadHash).toMatch(/[a-f0-9]{64}/);
    expect(pack.yamlLyrics).toContain("Ghost Station");
  });

  it("detects missing prompt pack artifacts", () => {
    const validation = validateSunoPromptPack({ songId: "song-001" });
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("missing style");
  });

  it("persists prompt pack artifacts and ledger entries into the workspace", async () => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), "artist-runtime-pack-"));
    const result = await createAndPersistSunoPromptPack({
      workspaceRoot,
      songId: "song-001",
      songTitle: "Ghost Station",
      artistReason: "night transit residue",
      lyricsText: "駅の光だけが\nまだ私を覚えている",
      knowledgePackVersion: "test-pack",
      configSnapshot: { dryRun: true }
    });

    expect(result.packVersion).toBe(1);
    expect(result.ledgerEntryIds).toHaveLength(6);
    expect(readFileSync(result.artifactPaths.styleLatest, "utf8")).toContain("alternative pop");
    expect(readFileSync(result.artifactPaths.lyricsVersioned, "utf8")).toContain("駅の光だけが");
    expect(readFileSync(result.artifactPaths.promptLedger, "utf8")).toContain("\"stage\":\"suno_payload_build\"");
  });
});

describe("registration shells", () => {
  it("registers tools, hooks, services, and routes against a fake api", async () => {
    const registered = {
      tools: [] as string[],
      hooks: [] as string[],
      services: [] as string[],
      routes: [] as string[]
    };
    const api = {
      registerTool(definition: { name: string }) {
        registered.tools.push(definition.name);
      },
      registerHook(definition: { event: string }) {
        registered.hooks.push(definition.event);
      },
      registerService(definition: { name: string }) {
        registered.services.push(definition.name);
      },
      registerHttpRoute(definition: { path: string }) {
        registered.routes.push(definition.path);
      }
    };

    registerTools(api);
    registerHooks(api);
    registerServices(api);
    registerRoutes(api);

    expect(registered.tools).toContain("artist_suno_create_prompt_pack");
    expect(registered.hooks).toContain("agent:bootstrap");
    expect(registered.services).toContain("artistAutopilotService");
    expect(registered.routes).toContain("/plugins/artist-runtime/api/status");

    const status = await buildStatusResponse();
    expect(status.dryRun).toBe(true);
    expect(status.platforms.x.authority).toBe("auto_publish");
  });
});
