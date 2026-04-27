import { readFile, writeFile } from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { artistPersonaBlockStart, writeArtistPersona } from "../src/services/personaFileBuilder";
import { routeTelegramCommand } from "../src/services/telegramCommandRouter";
import { handleTelegramPersonaSessionMessage, readTelegramPersonaSession } from "../src/services/telegramPersonaSession";
import { soulPersonaBlockStart, writeSoulPersona } from "../src/services/soulFileBuilder";

const baseInput = {
  fromUserId: 123,
  chatId: 456
};

const artistAnswers = {
  artistName: "Neon Relay",
  identityLine: "An electronic singer-songwriter built from subway light and failed notifications.",
  soundDna: "ambient pop, glassy synth, close vocal",
  obsessions: "stations, broken ads, private signals",
  lyricsRules: "avoid cheap hope, direct imitation, generic slogans",
  socialVoice: "short, observant, unsalesy"
};

function makeRoot(): string {
  return mkdtempSync(join(tmpdir(), "artist-runtime-persona-commands-"));
}

describe("telegram persona commands", () => {
  it("runs /setup soul through two questions and writes SOUL.md", async () => {
    const root = makeRoot();

    const start = await routeTelegramCommand({ ...baseInput, text: "/setup soul", workspaceRoot: root });
    await expect(handleTelegramPersonaSessionMessage(root, "short, direct, lightly poetic", 1001)).resolves.toContain("S2.");
    await expect(handleTelegramPersonaSessionMessage(root, "reject weak ideas with one better alternative", 1002)).resolves.toContain(
      "SOUL preview"
    );
    await expect(handleTelegramPersonaSessionMessage(root, "/confirm", 1003)).resolves.toContain("SOUL saved");
    const soul = await readFile(join(root, "SOUL.md"), "utf8");

    expect(start.responseText).toContain("S1.");
    expect(soul).toContain(soulPersonaBlockStart);
    expect(soul).toContain("Conversation tone: short, direct, lightly poetic");
    await expect(readTelegramPersonaSession(root)).resolves.toBeUndefined();
  });

  it("shows ARTIST and SOUL summaries within a single-message bound", async () => {
    const root = makeRoot();
    await writeArtistPersona(root, artistAnswers);
    await writeSoulPersona(root, {
      conversationTone: "short and precise",
      refusalStyle: "say no with a reason"
    });

    const result = await routeTelegramCommand({ ...baseInput, text: "/persona show", workspaceRoot: root });

    expect(result.kind).toBe("persona");
    expect(result.responseText.length).toBeLessThanOrEqual(1600);
    expect(result.responseText).toContain("Artist: Neon Relay");
    expect(result.responseText).toContain("Conversation tone: short and precise");
  });

  it("edits one ARTIST field through preview and confirm while preserving marker exterior", async () => {
    const root = makeRoot();
    await writeFile(join(root, "ARTIST.md"), "# ARTIST.md\n\nBefore.\n", "utf8");
    await writeArtistPersona(root, artistAnswers);
    await writeFile(join(root, "ARTIST.md"), `${await readFile(join(root, "ARTIST.md"), "utf8")}\nAfter.\n`, "utf8");

    const start = await routeTelegramCommand({ ...baseInput, text: "/persona edit sound", workspaceRoot: root });
    await expect(handleTelegramPersonaSessionMessage(root, "cold folk, tape hiss, close vocal", 1001)).resolves.toContain(
      "Persona edit preview"
    );
    await expect(handleTelegramPersonaSessionMessage(root, "/confirm", 1002)).resolves.toContain("Persona field saved");
    const artist = await readFile(join(root, "ARTIST.md"), "utf8");

    expect(start.responseText).toContain("Editing sound");
    expect(artist).toContain("Before.");
    expect(artist).toContain("After.");
    expect(artist).toContain("cold folk");
    expect(artist).toContain(artistPersonaBlockStart);
  });

  it("requires confirmation for reset and cancel keeps files unchanged", async () => {
    const root = makeRoot();
    await writeArtistPersona(root, artistAnswers);
    await writeSoulPersona(root, {
      conversationTone: "brief",
      refusalStyle: "firm"
    });
    const beforeArtist = await readFile(join(root, "ARTIST.md"), "utf8");
    const beforeSoul = await readFile(join(root, "SOUL.md"), "utf8");

    const start = await routeTelegramCommand({ ...baseInput, text: "/persona reset", workspaceRoot: root });
    await expect(handleTelegramPersonaSessionMessage(root, "/cancel", 1001)).resolves.toContain("cancelled");

    expect(start.responseText).toContain("/confirm reset");
    await expect(readFile(join(root, "ARTIST.md"), "utf8")).resolves.toBe(beforeArtist);
    await expect(readFile(join(root, "SOUL.md"), "utf8")).resolves.toBe(beforeSoul);
  });

  it("resets only Telegram-managed persona blocks after /confirm reset", async () => {
    const root = makeRoot();
    await writeFile(join(root, "ARTIST.md"), "# ARTIST.md\n\nOuter note.\n", "utf8");
    await writeArtistPersona(root, artistAnswers);
    await writeSoulPersona(root, {
      conversationTone: "brief",
      refusalStyle: "firm"
    });

    await routeTelegramCommand({ ...baseInput, text: "/persona reset", workspaceRoot: root });
    await expect(handleTelegramPersonaSessionMessage(root, "/confirm reset", 1001)).resolves.toContain("were reset");
    const artist = await readFile(join(root, "ARTIST.md"), "utf8");
    const soul = await readFile(join(root, "SOUL.md"), "utf8");

    expect(artist).toContain("Outer note.");
    expect(artist).not.toContain(artistPersonaBlockStart);
    expect(soul).not.toContain(soulPersonaBlockStart);
  });

  it("supports /back during edit without writing the new value", async () => {
    const root = makeRoot();
    await writeArtistPersona(root, artistAnswers);

    await routeTelegramCommand({ ...baseInput, text: "/persona edit lyrics", workspaceRoot: root });
    await handleTelegramPersonaSessionMessage(root, "new lyric rule", 1001);
    await expect(handleTelegramPersonaSessionMessage(root, "/back", 1002)).resolves.toContain("Send the new value");
    const artist = await readFile(join(root, "ARTIST.md"), "utf8");

    expect(artist).not.toContain("new lyric rule");
  });
});

