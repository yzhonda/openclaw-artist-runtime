import { mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createSunoPromptPack } from "../src/suno-production/generatePromptPack";
import { createAndPersistSunoPromptPack } from "../src/services/sunoPromptPackFiles";
import { validateSunoPromptPack } from "../src/validators/promptPackValidator";
import { registerHooks } from "../src/hooks";
import { buildArtistMindResponse, buildAuditLogResponse, buildConfigResponse, buildPromptLedgerResponse, buildRecoveryResponse, buildStatusResponse, producerConsoleHtml, registerRoutes, uiBuildIsFresh } from "../src/routes";
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

  it("reads the latest prompt pack metadata dynamically", async () => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), "artist-runtime-pack-latest-"));
    await createAndPersistSunoPromptPack({
      workspaceRoot,
      songId: "song-001",
      songTitle: "Ghost Station",
      artistReason: "night transit residue",
      lyricsText: "one",
      knowledgePackVersion: "test-pack"
    });
    const second = await createAndPersistSunoPromptPack({
      workspaceRoot,
      songId: "song-001",
      songTitle: "Ghost Station",
      artistReason: "night transit residue again",
      lyricsText: "two",
      knowledgePackVersion: "test-pack"
    });

    expect(second.packVersion).toBe(2);
    const detail = await buildStatusResponse({ artist: { workspaceRoot } });
    expect(detail.musicSummary.latestPromptPackVersion).toBe(2);
  });

  it("detects stale producer console bundles", async () => {
    const root = mkdtempSync(join(tmpdir(), "artist-runtime-ui-fresh-"));
    mkdirSync(join(root, "ui", "src"), { recursive: true });
    mkdirSync(join(root, "ui", "dist"), { recursive: true });
    writeFileSync(join(root, "ui", "index.html"), "<!doctype html>", "utf8");
    writeFileSync(join(root, "ui", "package.json"), "{}", "utf8");
    writeFileSync(join(root, "ui", "vite.config.ts"), "export default {}", "utf8");
    writeFileSync(join(root, "ui", "src", "App.tsx"), "export const App = () => null;", "utf8");
    writeFileSync(join(root, "ui", "src", "main.tsx"), "console.log('main');", "utf8");
    writeFileSync(join(root, "ui", "src", "styles.css"), "body{}", "utf8");
    writeFileSync(join(root, "ui", "dist", "index.html"), "<!doctype html><div>built</div>", "utf8");

    const older = new Date("2024-01-01T00:00:00.000Z");
    const newer = new Date("2024-01-02T00:00:00.000Z");
    utimesSync(join(root, "ui", "index.html"), older, older);
    utimesSync(join(root, "ui", "package.json"), older, older);
    utimesSync(join(root, "ui", "vite.config.ts"), older, older);
    utimesSync(join(root, "ui", "src", "main.tsx"), older, older);
    utimesSync(join(root, "ui", "src", "styles.css"), older, older);
    utimesSync(join(root, "ui", "dist", "index.html"), older, older);
    utimesSync(join(root, "ui", "src", "App.tsx"), newer, newer);

    expect(await uiBuildIsFresh(root)).toBe(false);

    const newest = new Date("2024-01-03T00:00:00.000Z");
    utimesSync(join(root, "ui", "dist", "index.html"), newest, newest);
    expect(await uiBuildIsFresh(root)).toBe(true);
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
    expect(registered.tools).toContain("artist_song_ideate");
    expect(registered.hooks).toContain("agent:bootstrap");
    expect(registered.services).toContain("artistAutopilotService");
    expect(registered.routes).toContain("/plugins/artist-runtime/api/status");
    expect(registered.routes).toContain("/plugins/artist-runtime/api/run-cycle");
    expect(registered.routes).toContain("/plugins/artist-runtime/api/config");
    expect(registered.routes).toContain("/plugins/artist-runtime/api/artist-mind");
    expect(registered.routes).toContain("/plugins/artist-runtime/api/audit");
    expect(registered.routes).toContain("/plugins/artist-runtime/api/recovery");
    expect(registered.routes).toContain("/plugins/artist-runtime/api/prompt-ledger");
    expect(registered.routes).toContain("/plugins/artist-runtime/api/platforms/:id/connect");
    expect(registered.routes).toContain("/plugins/artist-runtime/api/platforms/:id/disconnect");
    expect(registered.routes).toContain("/plugins/artist-runtime/api/suno/connect");
    expect(registered.routes).toContain("/plugins/artist-runtime/api/suno/reconnect");
    expect(registered.routes).toContain("/plugins/artist-runtime/api/suno/runs");
    expect(registered.routes).toContain("/plugins/artist-runtime/api/suno/generate/:songId");

    const status = await buildStatusResponse();
    const artistMind = await buildArtistMindResponse();
    const audit = await buildAuditLogResponse();
    const promptLedger = await buildPromptLedgerResponse();
    const recovery = await buildRecoveryResponse();
    expect(status.dryRun).toBe(true);
    expect(status.platforms.x.authority).toBe("auto_publish");
    expect(typeof artistMind.artist).toBe("string");
    expect(Array.isArray(audit)).toBe(true);
    expect(Array.isArray(promptLedger)).toBe(true);
    expect(recovery.diagnostics.dryRun).toBe(true);
    const consoleHtml = await producerConsoleHtml();
    expect(consoleHtml).toContain("Artist Runtime");
    expect(consoleHtml).toContain("Run Cycle");
    expect((await buildConfigResponse()).artist.artistId).toBe("artist");
  });
});
