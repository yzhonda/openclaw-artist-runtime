import type { PersonaAnswers, PersonaField, TelegramPersonaSession } from "../types.js";

export interface PersonaWizardQuestion {
  field: Extract<PersonaField, "artistName" | "identityLine" | "soundDna" | "obsessions" | "lyricsRules" | "socialVoice">;
  label: string;
  prompt: string;
  defaultValue: string;
  validate: (value: string) => string | undefined;
}

const minTextLength = (label: string, minLength: number) => (value: string): string | undefined =>
  value.trim().length >= minLength ? undefined : `${label} must be at least ${minLength} characters. Send /skip to use the default.`;

export const artistPersonaQuestions: PersonaWizardQuestion[] = [
  {
    field: "artistName",
    label: "Artist name",
    prompt: 'Q1. Artist name? Example: "used::honda". Send /skip for a temporary name.',
    defaultValue: "Unnamed OpenClaw Artist",
    validate: minTextLength("Artist name", 2)
  },
  {
    field: "identityLine",
    label: "Core image",
    prompt: 'Q2. What is this artist in one sentence? Example: "An electronic singer-songwriter built from night logs and ad glow."',
    defaultValue: "A public musical artist that turns observations into autonomous songs.",
    validate: minTextLength("Core image", 8)
  },
  {
    field: "soundDna",
    label: "Sound DNA",
    prompt: "Q3. Name up to three sound DNA traits: genre, texture, tempo, or vocal feel.",
    defaultValue: "alternative pop, glassy synth texture, close controlled vocal",
    validate: minTextLength("Sound DNA", 5)
  },
  {
    field: "obsessions",
    label: "Obsessions",
    prompt: "Q4. What does the artist keep returning to? Give up to three objects, places, or emotional weather systems.",
    defaultValue: "night infrastructure, private signals, lonely machines",
    validate: minTextLength("Obsessions", 5)
  },
  {
    field: "lyricsRules",
    label: "Lyrics guard",
    prompt: "Q5. What should the lyrics avoid? Name weak words, attitudes, or lines the artist refuses.",
    defaultValue: "avoid cheap hope, direct imitation, generic slogans, and corporate uplift",
    validate: minTextLength("Lyrics guard", 5)
  },
  {
    field: "socialVoice",
    label: "Social voice",
    prompt: "Q6. How should the artist speak on social posts? Keep it short.",
    defaultValue: "short, observant, unsalesy, concrete",
    validate: minTextLength("Social voice", 5)
  }
];

export function getArtistPersonaQuestion(stepIndex: number): PersonaWizardQuestion | undefined {
  return artistPersonaQuestions[stepIndex];
}

export function formatArtistPersonaQuestion(stepIndex: number): string {
  const question = getArtistPersonaQuestion(stepIndex);
  if (!question) {
    return formatArtistPersonaPreview({});
  }
  return [
    question.prompt,
    "",
    "Commands: /skip uses the default, /back goes back, /cancel stops setup."
  ].join("\n");
}

export function completeArtistPersonaAnswers(pending: Partial<PersonaAnswers>): Required<Pick<
  PersonaAnswers,
  "artistName" | "identityLine" | "soundDna" | "obsessions" | "lyricsRules" | "socialVoice"
>> {
  const defaults = Object.fromEntries(artistPersonaQuestions.map((question) => [question.field, question.defaultValue]));
  return {
    artistName: String(pending.artistName ?? defaults.artistName),
    identityLine: String(pending.identityLine ?? defaults.identityLine),
    soundDna: String(pending.soundDna ?? defaults.soundDna),
    obsessions: String(pending.obsessions ?? defaults.obsessions),
    lyricsRules: String(pending.lyricsRules ?? defaults.lyricsRules),
    socialVoice: String(pending.socialVoice ?? defaults.socialVoice)
  };
}

export function formatArtistPersonaPreview(pending: Partial<PersonaAnswers>): string {
  const answers = completeArtistPersonaAnswers(pending);
  return [
    "Persona preview:",
    `Name: ${answers.artistName}`,
    `Sound: ${answers.soundDna}`,
    `Themes: ${answers.obsessions}`,
    `Lyrics guard: ${answers.lyricsRules}`,
    `Social voice: ${answers.socialVoice}`,
    "",
    "Write this to ARTIST.md? Reply /confirm or /back."
  ].join("\n");
}

export function isArtistPersonaPreviewStep(session: TelegramPersonaSession): boolean {
  return session.mode === "setup_artist" && session.stepIndex >= artistPersonaQuestions.length;
}

