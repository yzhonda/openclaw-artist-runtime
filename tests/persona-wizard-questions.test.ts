import { describe, expect, it } from "vitest";
import {
  artistPersonaQuestions,
  completeArtistPersonaAnswers,
  formatArtistPersonaPreview,
  formatArtistPersonaQuestion
} from "../src/services/personaWizardQuestions";

describe("persona wizard questions", () => {
  it("defines the lean six ARTIST setup questions in order", () => {
    expect(artistPersonaQuestions.map((question) => question.field)).toEqual([
      "artistName",
      "identityLine",
      "soundDna",
      "obsessions",
      "lyricsRules",
      "socialVoice"
    ]);
    expect(formatArtistPersonaQuestion(0)).toContain("Q1. Artist name");
    expect(formatArtistPersonaQuestion(5)).toContain("Q6. How should the artist speak");
  });

  it("fills skipped answers with defaults and keeps preview valid", () => {
    const answers = completeArtistPersonaAnswers({ artistName: "Neon Relay" });
    const preview = formatArtistPersonaPreview({ artistName: "Neon Relay" });

    expect(answers.artistName).toBe("Neon Relay");
    expect(answers.soundDna).toContain("alternative pop");
    expect(preview).toContain("Persona preview:");
    expect(preview).toContain("Name: Neon Relay");
    expect(preview).toContain("Reply /confirm or /back");
  });

  it("rejects answers that are too short", () => {
    expect(artistPersonaQuestions[0].validate("x")).toContain("Artist name");
    expect(artistPersonaQuestions[1].validate("short")).toContain("Core image");
  });
});

