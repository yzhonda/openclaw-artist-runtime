import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { PersonaAnswers } from "../types.js";
import { completeArtistPersonaAnswers } from "./personaWizardQuestions.js";

export const artistPersonaBlockStart = "<!-- artist-runtime:persona:core:start -->";
export const artistPersonaBlockEnd = "<!-- artist-runtime:persona:core:end -->";

const artistNameTbdPattern = /(^|\n)\s*Artist name:\s*TBD\s*(\n|$)/i;
const sunoNameTbdPattern = /(^|\n)\s*name:\s*TBD\s*(\n|$)/i;
const secretPattern = /(TELEGRAM_BOT_TOKEN|bot\d+:[A-Za-z0-9_-]{30,}|API[_ -]?KEY|COOKIE|CREDENTIAL|PASSWORD|SECRET)/i;

export interface WriteArtistPersonaResult {
  path: string;
  mode: "replace_default" | "replace_marker" | "append_marker";
}

function artistPath(root: string): string {
  return join(root, "ARTIST.md");
}

function completionMarkerPath(root: string): string {
  return join(root, "runtime", "persona-completed.json");
}

function splitCommaish(value: string): string[] {
  return value
    .split(/[,、\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function buildArtistPersonaBlock(pending: Partial<PersonaAnswers>): string {
  const answers = completeArtistPersonaAnswers(pending);
  const soundTraits = splitCommaish(answers.soundDna);
  const obsessions = splitCommaish(answers.obsessions);
  const lyricRules = splitCommaish(answers.lyricsRules);
  const socialRules = splitCommaish(answers.socialVoice);

  return [
    artistPersonaBlockStart,
    "## Public Identity",
    "",
    `Artist name: ${answers.artistName}`,
    "",
    answers.identityLine,
    "",
    "## Producer Relationship",
    "",
    "The human is my producer. I listen seriously, but I keep artistic agency and may defend taste when the work needs it.",
    "",
    "## Current Artist Core",
    "",
    "- Core obsessions:",
    ...obsessions.map((item) => `  - ${item}`),
    "- Emotional weather:",
    "  - focused",
    "  - observant",
    "  - self-directed",
    "",
    "## Sound",
    "",
    ...soundTraits.map((item) => `- ${item}`),
    "",
    "## Lyrics",
    "",
    ...lyricRules.map((item) => `- ${item}`),
    "",
    "## Social Voice",
    "",
    ...socialRules.map((item) => `- ${item}`),
    "",
    "## Suno Production Profile",
    "",
    "```yaml",
    `name: ${answers.artistName}`,
    "genres:",
    ...soundTraits.slice(0, 3).map((item) => `  - ${item}`),
    "language: operator-defined",
    "source_channels:",
    "  - public observations",
    "  - producer notes",
    "  - artist diary",
    "```",
    "",
    "### Output rules",
    "",
    "- Always produce Style, Exclude, YAML lyrics, sliders, and payload for Suno.",
    "- Avoid direct artist-name prompting.",
    "- Describe sonic features instead of copying named artists.",
    artistPersonaBlockEnd
  ].join("\n");
}

export function assertPersonaBlockSafe(block: string): void {
  if (secretPattern.test(block)) {
    throw new Error("persona_block_contains_secret_like_text");
  }
}

function isDefaultArtistTemplate(contents: string): boolean {
  return !contents.trim() || artistNameTbdPattern.test(contents) || sunoNameTbdPattern.test(contents);
}

function replaceMarkerBlock(contents: string, block: string): string {
  const expression = new RegExp(`${artistPersonaBlockStart}[\\s\\S]*?${artistPersonaBlockEnd}`);
  return contents.replace(expression, block);
}

function insertAfterArtistHeading(contents: string, block: string): string {
  const heading = /^# ARTIST\.md\s*$/m;
  if (!heading.test(contents)) {
    return `${block}\n\n${contents.trimEnd()}\n`;
  }
  return contents.replace(heading, `# ARTIST.md\n\n${block}`);
}

export async function writeArtistPersona(root: string, pending: Partial<PersonaAnswers>): Promise<WriteArtistPersonaResult> {
  const path = artistPath(root);
  const existing = await readFile(path, "utf8").catch(() => "");
  const block = buildArtistPersonaBlock(pending);
  assertPersonaBlockSafe(block);

  let mode: WriteArtistPersonaResult["mode"];
  let nextContents: string;
  if (existing.includes(artistPersonaBlockStart) && existing.includes(artistPersonaBlockEnd)) {
    mode = "replace_marker";
    nextContents = replaceMarkerBlock(existing, block);
  } else if (isDefaultArtistTemplate(existing)) {
    mode = "replace_default";
    nextContents = `# ARTIST.md\n\n${block}\n`;
  } else {
    mode = "append_marker";
    nextContents = insertAfterArtistHeading(existing, block);
  }

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, nextContents.endsWith("\n") ? nextContents : `${nextContents}\n`, "utf8");
  return { path, mode };
}

export async function writePersonaCompletionMarker(root: string, now = new Date()): Promise<string> {
  const path = completionMarkerPath(root);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    `${JSON.stringify({ completedAt: now.toISOString(), source: "telegram", version: 1 }, null, 2)}\n`,
    "utf8"
  );
  return path;
}
