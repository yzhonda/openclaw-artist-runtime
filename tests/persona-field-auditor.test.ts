import { mkdir, writeFile } from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { auditPersonaCompleteness, formatPersonaAuditReport } from "../src/services/personaFieldAuditor";

function makeRoot(): string {
  return mkdtempSync(join(tmpdir(), "artist-runtime-persona-audit-"));
}

async function writeFixture(root: string): Promise<void> {
  await mkdir(root, { recursive: true });
  await writeFile(
    join(root, "ARTIST.md"),
    [
      "# ARTIST.md",
      "",
      "## Public Identity",
      "",
      "Artist name: Obsidian Artist",
      "",
      "A nocturnal producer-avatar that writes from stations, platform ads, and weathered signals.",
      "",
      "## Producer Relationship",
      "",
      "The human is my producer; I can refuse weak direction with a better route.",
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
      "- Cold synth folk, close vocal, tape hiss, field-recorded station ambience.",
      "",
      "## Lyrics",
      "",
      "- Avoid cheap hope, direct imitation, and generic slogans.",
      "",
      "## Suno Production Profile",
      "",
      "```yaml",
      "name: Obsidian Artist",
      "```",
      "",
      "## Voice",
      "",
      "- This custom voice section must stay outside the managed marker.",
      "",
      "## Listener",
      "",
      "- People who like quiet static and late trains."
    ].join("\n"),
    "utf8"
  );
  await writeFile(
    join(root, "SOUL.md"),
    [
      "# SOUL.md",
      "",
      "## Conversational Core",
      "",
      "Keep answers short and rough-edged.",
      "",
      "## Ritual",
      "",
      "Custom soul section."
    ].join("\n"),
    "utf8"
  );
}

describe("persona field auditor", () => {
  it("detects filled, thin, missing, external import, and custom sections", async () => {
    const root = makeRoot();
    await writeFixture(root);

    const report = await auditPersonaCompleteness(root);
    const byField = new Map(report.fields.map((field) => [field.field, field]));

    expect(report.artistFile).toEqual({ exists: true, markerPresent: false, externalImport: true });
    expect(report.soulFile).toEqual({ exists: true, markerPresent: false });
    expect(byField.get("artistName")?.status).toBe("thin");
    expect(byField.get("soundDna")?.status).toBe("filled");
    expect(byField.get("obsessions")?.status).toBe("thin");
    expect(byField.get("socialVoice")?.status).toBe("missing");
    expect(byField.get("soul-tone")?.status).toBe("missing");
    expect(byField.get("soul-refusal")?.status).toBe("missing");
    expect(report.customSections).toEqual(expect.arrayContaining(["Voice", "Listener", "Conversational Core", "Ritual"]));
    expect(report.summary).toMatchObject({ filled: 3, thin: 2, missing: 3 });
  });

  it("formats a compact operator-facing audit report", async () => {
    const root = makeRoot();
    await writeFixture(root);

    const text = formatPersonaAuditReport(await auditPersonaCompleteness(root));

    expect(text).toContain("Persona audit:");
    expect(text).toContain("externalImport=yes");
    expect(text).toContain("- socialVoice: missing");
    expect(text).toContain("Custom sections: Voice, Listener");
    expect(text.length).toBeLessThan(1400);
  });
});
