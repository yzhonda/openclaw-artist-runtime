import { readFile, writeFile } from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeArtistPersona } from "../src/services/personaFileBuilder";
import { routeTelegramCommand } from "../src/services/telegramCommandRouter";
import { handleTelegramPersonaSessionMessage, readTelegramPersonaSession } from "../src/services/telegramPersonaSession";
import { writeSoulPersona } from "../src/services/soulFileBuilder";

const base = { fromUserId: 123, chatId: 456 };

function makeRoot(): string {
  return mkdtempSync(join(tmpdir(), "artist-runtime-persona-check-"));
}

async function writeSparsePersona(root: string): Promise<void> {
  await writeFile(
    join(root, "ARTIST.md"),
    [
      "# ARTIST.md",
      "",
      "## Public Identity",
      "",
      "Artist name: Obsidian Artist",
      "",
      "A detailed imported identity line from an external notebook.",
      "",
      "## Current Artist Core",
      "",
      "- Core obsessions:",
      "  - neon",
      "- Emotional weather:",
      "  - controlled",
      "",
      "## Sound",
      "",
      "- Cold synth folk, tape hiss, close vocal, station ambience.",
      "",
      "## Lyrics",
      "",
      "- Avoid direct imitation and cheap slogans.",
      "",
      "## Voice",
      "",
      "- Custom section."
    ].join("\n"),
    "utf8"
  );
  await writeFile(join(root, "SOUL.md"), "# SOUL.md\n\n## Conversational Core\n\nShort and direct.\n", "utf8");
}

describe("telegram persona check command", () => {
  it("reports all fields filled for managed ARTIST and SOUL personas", async () => {
    const root = makeRoot();
    await writeArtistPersona(root, {
      artistName: "Neon Relay Project Unit",
      identityLine: "A public artist built from stations and late train lights.",
      soundDna: "ambient pop, glassy synth, close vocal",
      obsessions: "stations, broken ads, private signals",
      lyricsRules: "avoid cheap hope, direct imitation, generic slogans",
      socialVoice: "short, observant, unsalesy, concrete"
    });
    await writeSoulPersona(root, {
      conversationTone: "short, direct, observant, and loyal to the work",
      refusalStyle: "Reject weak ideas with a clear reason and one better route."
    });

    const result = await routeTelegramCommand({ ...base, text: "/persona check", workspaceRoot: root });

    expect(result.responseText).toContain("Summary: 8 filled, 0 thin, 0 missing");
  });

  it("reports missing and thin fields for an imported sparse persona", async () => {
    const root = makeRoot();
    await writeSparsePersona(root);

    const result = await routeTelegramCommand({ ...base, text: "/persona check", workspaceRoot: root });

    expect(result.responseText).toContain("obsessions: thin");
    expect(result.responseText).toContain("socialVoice: missing");
    expect(result.responseText).toContain("soul-refusal: missing");
    expect(result.responseText).toContain("Custom sections: Voice, Conversational Core");
  });

  it("fills missing fields through a chained edit session", async () => {
    const root = makeRoot();
    await writeFile(
      join(root, "ARTIST.md"),
      [
        "# ARTIST.md",
        "",
        "## Public Identity",
        "",
        "Artist name: Chain Artist Project",
        "",
        "A filled identity line for the chained edit test.",
        "",
        "## Sound",
        "",
        "- Cold folk tape hiss and close vocal detail.",
        "",
        "## Lyrics",
        "",
        "- Avoid fake uplift and copied voices."
      ].join("\n"),
      "utf8"
    );
    await writeSoulPersona(root, {
      conversationTone: "short, direct, observant, and loyal to the work",
      refusalStyle: "Reject weak ideas with a clear reason and one better route."
    });

    const start = await routeTelegramCommand({ ...base, text: "/persona check fill", workspaceRoot: root });
    const session = await readTelegramPersonaSession(root);
    expect(start.responseText).toContain("Starting fill chain");
    expect(session?.mode).toBe("check_fill_chain");
    await expect(handleTelegramPersonaSessionMessage(root, "private signals, broken ads, late trains")).resolves.toContain(
      "Persona edit preview"
    );
    await expect(handleTelegramPersonaSessionMessage(root, "/confirm")).resolves.toContain("Next: socialVoice");
    await expect(handleTelegramPersonaSessionMessage(root, "short, observant, unsalesy, concrete")).resolves.toContain(
      "Persona edit preview"
    );
    await expect(handleTelegramPersonaSessionMessage(root, "/confirm")).resolves.toContain("All fields complete");
    const artist = await readFile(join(root, "ARTIST.md"), "utf8");
    expect(artist).toContain("private signals");
    expect(artist).toContain("- short");
    expect(artist).toContain("- observant");
    expect(artist).toContain("- unsalesy");
  });

  it("returns mock suggestion placeholder for suggest mode", async () => {
    const root = makeRoot();
    await writeSparsePersona(root);

    const result = await routeTelegramCommand({ ...base, text: "/persona check suggest", workspaceRoot: root, aiReviewProvider: "mock" });

    expect(result.responseText).toContain("Persona suggestion mode");
    expect(result.responseText).toContain("Mock provider");
  });

  it("summarizes audit output when the full report would exceed one Telegram message", async () => {
    const root = makeRoot();
    await writeSparsePersona(root);
    const custom = Array.from({ length: 80 }, (_, index) => [`## Custom ${index}`, "", "body"].join("\n")).join("\n\n");
    await writeFile(join(root, "SOUL.md"), `# SOUL.md\n\n${custom}\n`, "utf8");

    const result = await routeTelegramCommand({ ...base, text: "/persona check", workspaceRoot: root });

    expect(result.responseText.length).toBeLessThanOrEqual(1500);
    expect(result.responseText).toContain("Persona check:");
    expect(result.responseText).toContain("Needs:");
  });
});
