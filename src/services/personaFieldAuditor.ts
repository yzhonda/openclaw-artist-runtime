import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PersonaField } from "../types.js";
import { artistPersonaBlockEnd, artistPersonaBlockStart, readArtistPersonaSummary } from "./personaFileBuilder.js";
import { readPersonaSetupStatus } from "./personaSetupDetector.js";
import { readSoulPersonaSummary, soulPersonaBlockEnd, soulPersonaBlockStart } from "./soulFileBuilder.js";

export type PersonaFieldStatus = "filled" | "thin" | "missing";

export interface PersonaFieldAudit {
  field: PersonaField;
  status: PersonaFieldStatus;
  reason?: string;
  current?: string;
}

export interface PersonaAuditReport {
  artistFile: { exists: boolean; markerPresent: boolean; externalImport: boolean };
  soulFile: { exists: boolean; markerPresent: boolean };
  fields: PersonaFieldAudit[];
  customSections: string[];
  summary: { filled: number; thin: number; missing: number };
}

const standardArtistSections = new Set([
  "Public Identity",
  "Producer Relationship",
  "Current Artist Core",
  "Sound",
  "Lyrics",
  "Social Voice",
  "Suno Production Profile"
]);
const standardSoulSections = new Set(["Telegram Persona Voice"]);
const placeholderPattern = /^(?:tbd|unknown artist|\(not set\)|n\/a|none|-+)?$/i;
const minFilledLength = 20;

function artistPath(root: string): string {
  return join(root, "ARTIST.md");
}

function soulPath(root: string): string {
  return join(root, "SOUL.md");
}

function truncateCurrent(value: string): string | undefined {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return undefined;
  }
  return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized;
}

function auditField(field: PersonaField, value: string): PersonaFieldAudit {
  const current = truncateCurrent(value);
  if (!current) {
    return { field, status: "missing", reason: "empty_or_absent" };
  }
  if (placeholderPattern.test(current)) {
    return { field, status: "thin", reason: "default_placeholder", current };
  }
  if (current.length < minFilledLength) {
    return { field, status: "thin", reason: "shorter_than_20_chars", current };
  }
  return { field, status: "filled", current };
}

function headings(contents: string): string[] {
  return [...contents.matchAll(/^##\s+(.+?)\s*$/gm)].map((match) => match[1].trim());
}

function customSectionsFor(contents: string, standard: Set<string>): string[] {
  return headings(contents).filter((heading) => !standard.has(heading));
}

function countSummary(fields: PersonaFieldAudit[]): PersonaAuditReport["summary"] {
  return fields.reduce(
    (summary, field) => ({ ...summary, [field.status]: summary[field.status] + 1 }),
    { filled: 0, thin: 0, missing: 0 }
  );
}

export async function auditPersonaCompleteness(root: string): Promise<PersonaAuditReport> {
  const [artistContents, soulContents, artistSummary, soulSummary, setupStatus] = await Promise.all([
    readFile(artistPath(root), "utf8").catch(() => ""),
    readFile(soulPath(root), "utf8").catch(() => ""),
    readArtistPersonaSummary(root),
    readSoulPersonaSummary(root),
    readPersonaSetupStatus(root)
  ]);
  const artistMarkerPresent = artistContents.includes(artistPersonaBlockStart) && artistContents.includes(artistPersonaBlockEnd);
  const soulMarkerPresent = soulContents.includes(soulPersonaBlockStart) && soulContents.includes(soulPersonaBlockEnd);
  const fields: PersonaFieldAudit[] = [
    auditField("artistName", artistSummary.artistName),
    auditField("identityLine", artistSummary.identityLine),
    auditField("soundDna", artistSummary.soundDna),
    auditField("obsessions", artistSummary.obsessions),
    auditField("lyricsRules", artistSummary.lyricsRules),
    auditField("socialVoice", artistSummary.socialVoice),
    auditField("soul-tone", soulSummary.conversationTone),
    auditField("soul-refusal", soulSummary.refusalStyle)
  ];
  const customSections = [
    ...customSectionsFor(artistContents, standardArtistSections),
    ...customSectionsFor(soulContents, standardSoulSections)
  ];

  return {
    artistFile: {
      exists: Boolean(artistContents.trim()),
      markerPresent: artistMarkerPresent,
      externalImport: setupStatus.completed && !setupStatus.marker
    },
    soulFile: { exists: Boolean(soulContents.trim()), markerPresent: soulMarkerPresent },
    fields,
    customSections: [...new Set(customSections)],
    summary: countSummary(fields)
  };
}

export function formatPersonaAuditReport(report: PersonaAuditReport): string {
  const lines = [
    "Persona audit:",
    `ARTIST.md: ${report.artistFile.exists ? "present" : "missing"} / marker=${report.artistFile.markerPresent ? "yes" : "no"} / externalImport=${report.artistFile.externalImport ? "yes" : "no"}`,
    `SOUL.md: ${report.soulFile.exists ? "present" : "missing"} / marker=${report.soulFile.markerPresent ? "yes" : "no"}`,
    `Summary: ${report.summary.filled} filled, ${report.summary.thin} thin, ${report.summary.missing} missing`,
    "",
    "Fields:",
    ...report.fields.map((field) =>
      [
        `- ${field.field}: ${field.status}`,
        field.reason ? ` (${field.reason})` : "",
        field.current ? ` - ${field.current}` : ""
      ].join("")
    )
  ];
  if (report.customSections.length > 0) {
    lines.push("", `Custom sections: ${report.customSections.join(", ")}`);
  }
  return lines.join("\n");
}
