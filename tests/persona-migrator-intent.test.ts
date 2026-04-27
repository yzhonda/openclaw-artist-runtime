import { mkdir, readFile, writeFile } from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatPersonaMigratePlan, executePersonaMigrate, planPersonaMigrate } from "../src/services/personaMigrator";
import { artistPersonaBlockStart } from "../src/services/personaFileBuilder";
import { soulPersonaBlockStart } from "../src/services/soulFileBuilder";

function makeRoot(): string {
  return mkdtempSync(join(tmpdir(), "artist-runtime-persona-migrate-intent-"));
}

async function writePersonaWithMissingFields(root: string): Promise<void> {
  await mkdir(root, { recursive: true });
  await writeFile(
    join(root, "ARTIST.md"),
    [
      "# ARTIST.md",
      "",
      "## Public Identity",
      "",
      "Artist name: Intent Artist",
      "",
      "An artist imported from a notebook with enough identity to keep.",
      "",
      "## Current Artist Core",
      "",
      "- Core obsessions:",
      "  - radio",
      "- Emotional weather:",
      "  - focused",
      "",
      "## Sound",
      "",
      "- Frosted station folk with close vocal and rusted percussion.",
      "",
      "## Lyrics",
      "",
      "- Avoid glossy slogans and direct voice cloning.",
      "",
      "## Voice",
      "",
      "- Custom voice material that should remain outside the marker."
    ].join("\n"),
    "utf8"
  );
  await writeFile(
    join(root, "SOUL.md"),
    [
      "<!-- custom imported soul header -->",
      "",
      "# SOUL.md",
      "",
      "Keep the operator close, but do not turn soft."
    ].join("\n"),
    "utf8"
  );
}

describe("persona migrate operator intent", () => {
  it("adds mock draft proposals for missing or thin fields and writes them on confirm", async () => {
    const root = makeRoot();
    await writePersonaWithMissingFields(root);

    const plan = await planPersonaMigrate(root, {
      intent: "Use the notebook Voice section, keep the tone blunt and unsalesy, and make social voice short.",
      aiReviewProvider: "mock"
    });
    const preview = formatPersonaMigratePlan(plan);

    expect(plan.operatorIntent).toContain("notebook Voice section");
    expect(plan.aiProvider).toBe("mock");
    expect(plan.proposedDrafts.map((draft) => draft.field)).toEqual(expect.arrayContaining(["socialVoice", "soul-tone", "soul-refusal"]));
    expect(preview).toContain("Operator intent:");
    expect(preview).toContain("Proposed drafts (AI provider=mock):");
    expect(preview).toContain("socialVoice:");

    await executePersonaMigrate(root, plan);
    const artist = await readFile(join(root, "ARTIST.md"), "utf8");
    const soul = await readFile(join(root, "SOUL.md"), "utf8");

    expect(artist).toContain(artistPersonaBlockStart);
    expect(soul).toContain(soulPersonaBlockStart);
    expect(artist).toContain("[mock proposal based on operator intent:");
    expect(soul).toContain("[mock proposal based on operator intent:");
    expect(soul).toContain("custom imported soul header");
  });

  it("honors field-specific skip directives in the preview", async () => {
    const root = makeRoot();
    await writePersonaWithMissingFields(root);

    const plan = await planPersonaMigrate(root, {
      intent: "socialVoice: keep as-is, skip. Draft only the SOUL refusal style from the imported prose.",
      aiReviewProvider: "mock"
    });
    const socialVoiceDraft = plan.proposedDrafts.find((draft) => draft.field === "socialVoice");

    expect(socialVoiceDraft).toMatchObject({ status: "skipped", reason: "skip per operator intent" });
    expect(formatPersonaMigratePlan(plan)).toContain("- socialVoice: skip per operator intent");
  });
});
