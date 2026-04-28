import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { auditPersonaCompleteness } from "../src/services/personaFieldAuditor";
import { routeTelegramCommand } from "../src/services/telegramCommandRouter";
import { handleTelegramPersonaSessionMessage, readTelegramPersonaSession } from "../src/services/telegramPersonaSession";

const base = { fromUserId: 123, chatId: 456 };

function makeRoot(): string {
  return mkdtempSync(join(tmpdir(), "artist-runtime-persona-check-fill-ai-"));
}

async function writeImportedSparsePersona(root: string): Promise<void> {
  await mkdir(root, { recursive: true });
  await writeFile(
    join(root, "ARTIST.md"),
    [
      "# ARTIST.md",
      "",
      "## Public Identity",
      "",
      "Artist name: Obsidian Artist Project",
      "",
      "A detailed imported identity line from an external notebook.",
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
      "- Custom voice section.",
      "",
      "## Listener",
      "",
      "- Custom listener section."
    ].join("\n"),
    "utf8"
  );
  await writeFile(join(root, "SOUL.md"), "# SOUL.md\n\n## Conversational Core\n\nShort and direct.\n", "utf8");
}

async function backupFiles(root: string): Promise<string[]> {
  return (await readdir(root)).filter((name) => name.includes(".backup-")).sort();
}

describe("telegram persona check fill AI e2e", () => {
  it("fills missing and thin fields from AI drafts while writing one backup per file per session", async () => {
    const root = makeRoot();
    await writeImportedSparsePersona(root);
    const before = await auditPersonaCompleteness(root);
    expect(before.summary).toMatchObject({ filled: 4, thin: 0, missing: 4 });

    const start = await routeTelegramCommand({ ...base, text: "/persona check fill", workspaceRoot: root });
    expect(start.responseText).toContain("Starting AI fill chain");
    expect(start.responseText).toContain("Field 1/4: obsessions");
    expect(await readTelegramPersonaSession(root)).toMatchObject({ mode: "check_fill_chain" });

    for (let index = 0; index < 4; index += 1) {
      const response = await handleTelegramPersonaSessionMessage(root, "/confirm", 1000 + index);
      expect(response).toMatch(index === 3 ? /All fields complete/ : new RegExp(`${index + 2}/4`));
    }

    const after = await auditPersonaCompleteness(root);
    expect(after.summary.missing).toBe(0);
    const artist = await readFile(join(root, "ARTIST.md"), "utf8");
    const soul = await readFile(join(root, "SOUL.md"), "utf8");
    expect(artist).toContain("night infrastructure");
    expect(artist).toContain("- short");
    expect(artist).toContain("- observant");
    expect(artist).toContain("- unsalesy");
    expect(soul).toContain("Conversation tone: short, direct, observant, and artistically opinionated");
    expect(await backupFiles(root)).toHaveLength(2);
  });

  it("uses two-step skip confirmation without writing the skipped field", async () => {
    const root = makeRoot();
    await writeImportedSparsePersona(root);
    await routeTelegramCommand({ ...base, text: "/persona check fill", workspaceRoot: root });

    await expect(handleTelegramPersonaSessionMessage(root, "/skip", 1001)).resolves.toContain("Alternative draft generated");
    await expect(handleTelegramPersonaSessionMessage(root, "/skip", 1002)).resolves.toContain("/confirm skip");
    await expect(handleTelegramPersonaSessionMessage(root, "/confirm skip", 1003)).resolves.toContain("2/4");

    const artist = await readFile(join(root, "ARTIST.md"), "utf8");
    expect(artist).not.toContain("night infrastructure");
  });
});
