import { describe, expect, it } from "vitest";

// @ts-expect-error -- importing a .mjs script is fine for vitest's runtime check.
import {
  buildBriefMd,
  buildSongMd,
  parseFrontmatter,
  parseSlidersTable,
  splitTopSections
} from "../scripts/import-obsidian-song.mjs";

const STYLE_SAMPLE = `---
title: "Where It Played"
artist: "[[artists/used-honda]]"
reference: "Squarepusher - Beep Street"
tags: [style, suno]
---

# Style (990 chars)

Drill n bass electronic fusion rap, urgent cultural elegy

- BPM: 145
- Key: F minor

# Exclude Styles (< 200 chars)

Trap 808, auto-tune, pop vocal

# Sliders

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Weirdness | 55 | exp |
| Style Influence | 75 | lock |
| Audio Influence | 25 | default |
`;

describe("import-obsidian-song parser", () => {
  it("splits the style.md into Style / Exclude / Sliders top-level sections", () => {
    const { body } = parseFrontmatter(STYLE_SAMPLE);
    const sections = splitTopSections(body);
    expect(sections.has("Style")).toBe(true);
    expect(sections.has("Exclude Styles")).toBe(true);
    expect(sections.has("Sliders")).toBe(true);
    expect(sections.get("Style")).toContain("Drill n bass electronic fusion rap");
    expect(sections.get("Exclude Styles")).toContain("Trap 808");
  });

  it("strips `(<n> chars)` suffixes from heading titles", () => {
    const { body } = parseFrontmatter(STYLE_SAMPLE);
    const sections = splitTopSections(body);
    expect(sections.has("Style (990 chars)")).toBe(false);
    expect(sections.has("Exclude Styles (< 200 chars)")).toBe(false);
  });

  it("parses the Sliders markdown table into a camelCase numeric map", () => {
    const { body } = parseFrontmatter(STYLE_SAMPLE);
    const sections = splitTopSections(body);
    const sliders = parseSlidersTable(sections.get("Sliders"));
    expect(sliders).toEqual({
      weirdness: 55,
      styleInfluence: 75,
      audioInfluence: 25
    });
  });

  it("builds song.md with state markers and the correct status", () => {
    const md = buildSongMd({ songId: "where-it-played", title: "Where It Played", status: "lyrics" });
    expect(md).toContain("# Where It Played");
    expect(md).toContain("- Song ID: where-it-played");
    expect(md).toContain("- Status: lyrics");
    expect(md).toContain("artist-runtime:song-state:start");
    expect(md).toContain("artist-runtime:song-state:end");
  });

  it("builds brief.md including title, reference, and a style summary", () => {
    const brief = buildBriefMd({
      title: "Where It Played",
      reference: "Squarepusher - Beep Street",
      styleSummary: "Drill n bass electronic fusion rap"
    });
    expect(brief).toContain("# Brief for Where It Played");
    expect(brief).toContain("Squarepusher - Beep Street");
    expect(brief).toContain("Drill n bass electronic fusion rap");
  });

  it("never embeds raw API tokens or cookies even when source contains the word", () => {
    const md = buildBriefMd({
      title: "Test",
      reference: "test reference",
      styleSummary: "neutral"
    });
    expect(md).not.toMatch(/api[_-]?key/i);
    expect(md).not.toMatch(/access[_-]?token/i);
  });
});
