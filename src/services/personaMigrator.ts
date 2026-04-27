import { constants } from "node:fs";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  artistPersonaBlockEnd,
  artistPersonaBlockStart,
  buildArtistPersonaBlock,
  readArtistPersonaSummary,
  writePersonaCompletionMarker
} from "./personaFileBuilder.js";
import { buildSoulPersonaBlock, readSoulPersonaSummary, soulPersonaBlockEnd, soulPersonaBlockStart } from "./soulFileBuilder.js";

export interface PersonaMigratePlan {
  artistBackupPath: string;
  soulBackupPath: string;
  artistMarkerInsertion: { existingSections: string[]; markerSections: string[] };
  soulMarkerInsertion: { existingSections: string[]; markerSections: string[] };
  warnings: string[];
}

interface MarkdownSection {
  level: number;
  heading: string;
  block: string;
}

const artistMarkerSections = [
  "Public Identity",
  "Producer Relationship",
  "Current Artist Core",
  "Sound",
  "Lyrics",
  "Social Voice",
  "Suno Production Profile"
];
const soulMarkerSections = ["Telegram Persona Voice"];

function artistPath(root: string): string {
  return join(root, "ARTIST.md");
}

function soulPath(root: string): string {
  return join(root, "SOUL.md");
}

function utcStamp(now = new Date()): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(() => true, () => false);
}

async function uniqueBackupPath(path: string): Promise<string> {
  const base = `${path}.backup-${utcStamp()}`;
  if (!(await exists(base))) {
    return base;
  }
  for (let index = 1; index < 1000; index += 1) {
    const candidate = `${base}.${index}`;
    if (!(await exists(candidate))) {
      return candidate;
    }
  }
  throw new Error("persona_backup_path_exhausted");
}

function parseSections(contents: string): MarkdownSection[] {
  const matches = [...contents.matchAll(/^(#{2,3})\s+(.+?)\s*$/gm)];
  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? contents.length;
    return { level: match[1].length, heading: match[2].trim(), block: contents.slice(start, end).trim() };
  });
}

function h2Sections(contents: string): string[] {
  return parseSections(contents).filter((section) => section.level === 2).map((section) => section.heading);
}

function customBlocks(contents: string, markerSections: string[]): string[] {
  const marker = new Set(markerSections);
  return parseSections(contents)
    .filter((section) => !marker.has(section.heading))
    .map((section) => section.block)
    .filter(Boolean);
}

function withHeading(title: string, markerBlock: string, custom: string[]): string {
  return [`# ${title}`, "", markerBlock, ...custom.flatMap((block) => ["", block]), ""].join("\n");
}

function migrationValues(value: string, fallback = "TBD"): string {
  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}

async function buildMigratedArtist(root: string): Promise<string> {
  const contents = await readFile(artistPath(root), "utf8").catch(() => "");
  const summary = await readArtistPersonaSummary(root);
  const markerBlock = buildArtistPersonaBlock({
    artistName: migrationValues(summary.artistName, "TBD"),
    identityLine: migrationValues(summary.identityLine, "TBD"),
    soundDna: migrationValues(summary.soundDna, "TBD"),
    obsessions: migrationValues(summary.obsessions, "TBD"),
    lyricsRules: migrationValues(summary.lyricsRules, "TBD"),
    socialVoice: migrationValues(summary.socialVoice, "TBD")
  });
  return withHeading("ARTIST.md", markerBlock, customBlocks(contents, artistMarkerSections));
}

async function buildMigratedSoul(root: string): Promise<string> {
  const contents = await readFile(soulPath(root), "utf8").catch(() => "");
  const summary = await readSoulPersonaSummary(root);
  const markerBlock = buildSoulPersonaBlock({
    conversationTone: migrationValues(summary.conversationTone, "TBD"),
    refusalStyle: migrationValues(summary.refusalStyle, "TBD")
  });
  return withHeading("SOUL.md", markerBlock, customBlocks(contents, soulMarkerSections));
}

async function backupIfPresent(source: string, backup: string): Promise<void> {
  if (!(await exists(source))) {
    return;
  }
  await mkdir(dirname(backup), { recursive: true });
  await copyFile(source, backup, constants.COPYFILE_EXCL);
}

export async function planPersonaMigrate(root: string): Promise<PersonaMigratePlan> {
  const [artistContents, soulContents] = await Promise.all([
    readFile(artistPath(root), "utf8").catch(() => ""),
    readFile(soulPath(root), "utf8").catch(() => "")
  ]);
  const artistAlreadyMigrated = artistContents.includes(artistPersonaBlockStart) && artistContents.includes(artistPersonaBlockEnd);
  const soulAlreadyMigrated = soulContents.includes(soulPersonaBlockStart) && soulContents.includes(soulPersonaBlockEnd);
  const warnings: string[] = [];
  if (artistAlreadyMigrated && soulAlreadyMigrated) {
    warnings.push("already migrated");
  }
  if (!artistContents.trim()) {
    warnings.push("ARTIST.md missing or empty; migrator will create a placeholder managed block");
  }
  if (!soulContents.trim()) {
    warnings.push("SOUL.md missing or empty; migrator will create a placeholder managed block");
  }
  return {
    artistBackupPath: await uniqueBackupPath(artistPath(root)),
    soulBackupPath: await uniqueBackupPath(soulPath(root)),
    artistMarkerInsertion: {
      existingSections: h2Sections(artistContents),
      markerSections: artistMarkerSections
    },
    soulMarkerInsertion: {
      existingSections: h2Sections(soulContents),
      markerSections: soulMarkerSections
    },
    warnings
  };
}

export async function executePersonaMigrate(root: string, plan: PersonaMigratePlan): Promise<void> {
  if (plan.warnings.includes("already migrated")) {
    return;
  }
  const [artist, soul] = await Promise.all([buildMigratedArtist(root), buildMigratedSoul(root)]);
  await Promise.all([
    backupIfPresent(artistPath(root), plan.artistBackupPath),
    backupIfPresent(soulPath(root), plan.soulBackupPath)
  ]);
  await Promise.all([
    mkdir(dirname(artistPath(root)), { recursive: true }),
    mkdir(dirname(soulPath(root)), { recursive: true })
  ]);
  await Promise.all([
    writeFile(artistPath(root), artist.endsWith("\n") ? artist : `${artist}\n`, "utf8"),
    writeFile(soulPath(root), soul.endsWith("\n") ? soul : `${soul}\n`, "utf8")
  ]);
  await writePersonaCompletionMarker(root);
}

export function formatPersonaMigratePlan(plan: PersonaMigratePlan): string {
  return [
    "Persona migrate plan:",
    `ARTIST backup: ${plan.artistBackupPath}`,
    `SOUL backup: ${plan.soulBackupPath}`,
    `ARTIST marker sections: ${plan.artistMarkerInsertion.markerSections.join(", ")}`,
    `ARTIST existing sections: ${plan.artistMarkerInsertion.existingSections.join(", ") || "(none)"}`,
    `SOUL marker sections: ${plan.soulMarkerInsertion.markerSections.join(", ")}`,
    `SOUL existing sections: ${plan.soulMarkerInsertion.existingSections.join(", ") || "(none)"}`,
    plan.warnings.length > 0 ? `Warnings: ${plan.warnings.join("; ")}` : "Warnings: none",
    "",
    "Reply /confirm migrate to write marker blocks, or /cancel."
  ].join("\n");
}
