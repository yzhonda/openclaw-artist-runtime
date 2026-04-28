import { mkdir, writeFile } from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { routeTelegramCommand } from "../src/services/telegramCommandRouter";
import { handleTelegramPersonaSessionMessage } from "../src/services/telegramPersonaSession";

const baseInput = { fromUserId: 123, chatId: 456 };

function makeRoot(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

async function writeOpenClawAuthFixture(root: string): Promise<{ configPath: string; authProfilesPath: string }> {
  await mkdir(root, { recursive: true });
  const configPath = join(root, "openclaw.json");
  const authProfilesPath = join(root, "auth-profiles.json");
  await writeFile(
    configPath,
    `${JSON.stringify({
      agents: { defaults: { model: { primary: "openai-codex/gpt-5.5" } } },
      auth: { profiles: { "openai-codex:test@example.invalid": {} } }
    })}\n`,
    "utf8"
  );
  await writeFile(
    authProfilesPath,
    `${JSON.stringify({
      version: 1,
      profiles: {
        "openai-codex:test@example.invalid": {
          type: "oauth",
          provider: "openai-codex",
          access: "placeholder-access",
          expires: Date.now() + 60_000
        }
      }
    })}\n`,
    "utf8"
  );
  return { configPath, authProfilesPath };
}

function sseResponse(text: string): Response {
  return new Response([
    "event: response.output_text.delta",
    `data: ${JSON.stringify({ type: "response.output_text.delta", delta: text })}`,
    "",
    "event: response.completed",
    "data: {\"type\":\"response.completed\",\"response\":{\"status\":\"completed\"}}",
    ""
  ].join("\n"), { status: 200, headers: { "content-type": "text/event-stream" } });
}

async function writeSparsePersona(root: string): Promise<void> {
  await mkdir(root, { recursive: true });
  await writeFile(
    join(root, "ARTIST.md"),
    [
      "# ARTIST.md",
      "",
      "## Public Identity",
      "",
      "Artist name: Provider Test",
      "",
      "A complete imported identity line.",
      "",
      "## Sound",
      "",
      "- Cold synth folk with close vocal.",
      "",
      "## Lyrics",
      "",
      "- Avoid cheap slogans."
    ].join("\n"),
    "utf8"
  );
  await writeFile(join(root, "SOUL.md"), "# SOUL.md\n\nShort imported voice.\n", "utf8");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("telegram persona provider propagation", () => {
  it("passes aiReviewProvider from /setup into rough-input and alternate setup drafts", async () => {
    const fixtureRoot = makeRoot("artist-runtime-provider-fixture-");
    const { configPath, authProfilesPath } = await writeOpenClawAuthFixture(fixtureRoot);
    vi.stubEnv("OPENCLAW_CONFIG", configPath);
    vi.stubEnv("OPENCLAW_AUTH_PROFILES", authProfilesPath);
    vi.stubGlobal("fetch", vi.fn(async () => sseResponse([
      "artistName: Codex Artist (origin: provider)",
      "identityLine: A precise field-aware artist (origin: provider)",
      "soundDna: clipped drums, static bass, close vocal (origin: provider)",
      "obsessions: social satire and busted infrastructure (origin: provider)",
      "lyricsRules: no token leaks, no cheap uplift (origin: provider)",
      "socialVoice: short, dry, unsalesy (origin: provider)",
      "soul-tone: direct and loyal (origin: provider)",
      "soul-refusal: say no cleanly with one alternative (origin: provider)"
    ].join("\n"))));

    const root = makeRoot("artist-runtime-provider-setup-");
    await expect(routeTelegramCommand({
      ...baseInput,
      text: "/setup",
      workspaceRoot: root,
      aiReviewProvider: "openai-codex"
    })).resolves.toMatchObject({ kind: "setup" });
    await expect(handleTelegramPersonaSessionMessage(root, "rough artist sketch", 1001)).resolves.toContain("Codex Artist");
    expect(fetch).toHaveBeenCalledTimes(1);

    vi.mocked(fetch).mockResolvedValueOnce(sseResponse("artistName: Alternate Codex Artist (origin: provider)"));
    await expect(handleTelegramPersonaSessionMessage(root, "/skip", 1002)).resolves.toContain("Alternate Codex Artist");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("passes aiReviewProvider from /persona check fill into initial and alternate fill drafts", async () => {
    const fixtureRoot = makeRoot("artist-runtime-provider-fixture-");
    const { configPath, authProfilesPath } = await writeOpenClawAuthFixture(fixtureRoot);
    vi.stubEnv("OPENCLAW_CONFIG", configPath);
    vi.stubEnv("OPENCLAW_AUTH_PROFILES", authProfilesPath);
    vi.stubGlobal("fetch", vi.fn(async () => sseResponse([
      "artistName: Provider Artist (origin: provider)",
      "obsessions: Codex field obsession (origin: provider)",
      "socialVoice: Codex field voice (origin: provider)",
      "soul-tone: Codex field tone (origin: provider)",
      "soul-refusal: Codex field refusal (origin: provider)"
    ].join("\n"))));

    const root = makeRoot("artist-runtime-provider-fill-");
    await writeSparsePersona(root);
    const start = await routeTelegramCommand({
      ...baseInput,
      text: "/persona check fill",
      workspaceRoot: root,
      aiReviewProvider: "openai-codex"
    });
    expect(start.responseText).toContain("Provider Artist");
    expect(fetch).toHaveBeenCalledTimes(1);

    vi.mocked(fetch).mockResolvedValueOnce(sseResponse("artistName: Alternate Provider Artist (origin: provider)"));
    await expect(handleTelegramPersonaSessionMessage(root, "/skip", 1001)).resolves.toContain("Alternate Provider Artist");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
