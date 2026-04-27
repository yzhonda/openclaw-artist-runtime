import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { AiReviewProvider, AutopilotStatus } from "../types.js";
import { AutopilotControlService } from "./autopilotControlService.js";
import { createDebugAiReviewer, formatDebugAiReviewResult, reviewSongDebugMaterial } from "./debugAiReviewService.js";
import { auditPersonaCompleteness, formatPersonaAuditReport, type PersonaFieldAudit } from "./personaFieldAuditor.js";
import { readArtistPersonaSummary } from "./personaFileBuilder.js";
import { getSongDetail, listRecentSongs } from "./songQueryService.js";
import { readSongMaterial } from "./songMaterialReader.js";
import { createTelegramPersonaSession } from "./telegramPersonaSession.js";
import { formatPersonaMigratePlan, planPersonaMigrate } from "./personaMigrator.js";
import { formatArtistPersonaQuestion } from "./personaWizardQuestions.js";
import { formatSoulPersonaQuestion, readSoulPersonaSummary } from "./soulFileBuilder.js";
import type { PersonaField } from "../types.js";

export type TelegramCommandKind =
  | "help"
  | "status"
  | "songs"
  | "song"
  | "regen"
  | "review"
  | "pause"
  | "resume"
  | "setup"
  | "persona"
  | "unknown"
  | "free_text";

export interface TelegramRouteInput {
  text: string;
  fromUserId: number;
  chatId: number;
  workspaceRoot?: string;
  autopilotStatus?: AutopilotStatus;
  aiReviewProvider?: AiReviewProvider;
}

export interface TelegramRouteResult {
  kind: TelegramCommandKind;
  responseText: string;
  shouldStoreFreeText: boolean;
}

function inboxPath(root: string): string {
  return join(root, "runtime", "telegram-inbox.jsonl");
}

function formatStatus(status?: AutopilotStatus): string {
  if (!status) {
    return "Autopilot status unavailable.";
  }
  return [
    `Autopilot: ${status.enabled ? "enabled" : "disabled"}${status.dryRun ? " (dry-run)" : ""}`,
    `Stage: ${status.stage}`,
    `Next: ${status.nextAction}`,
    status.currentSongId ? `Song: ${status.currentSongId}` : undefined,
    status.blockedReason ? `Blocked: ${status.blockedReason}` : undefined
  ].filter(Boolean).join("\n");
}

export async function routeTelegramCommand(input: TelegramRouteInput): Promise<TelegramRouteResult> {
  const text = input.text.trim();
  if (!text) {
    return {
      kind: "unknown",
      responseText: "Send /help for available artist-runtime commands.",
      shouldStoreFreeText: false
    };
  }

  const [commandRaw, ...args] = text.split(/\s+/);
  const command = commandRaw.toLowerCase();
  if (command === "/help" || command === "/start") {
    return {
      kind: "help",
      responseText: [
        "Available commands:",
        "/status - show autopilot status",
        "/songs - list recent songs",
        "/song <songId> - show song detail",
        "/regen <songId> - queue a dry-run regeneration note",
        "/review <songId> - run a debug-only mock AI review",
        "/setup - start Telegram artist persona setup",
        "/setup soul - configure SOUL.md voice",
        "/persona show|fields|edit <field>|check|reset|migrate - manage Telegram persona",
        "/pause - pause autopilot",
        "/resume - resume autopilot",
        "/help - show this help"
      ].join("\n"),
      shouldStoreFreeText: false
    };
  }

  if (command === "/setup") {
    if (!input.workspaceRoot) {
      return { kind: "setup", responseText: "Persona setup unavailable: workspace root missing.", shouldStoreFreeText: false };
    }
    if (args[0]?.toLowerCase() === "soul") {
      await createTelegramPersonaSession(input.workspaceRoot, {
        mode: "setup_soul",
        chatId: input.chatId,
        userId: input.fromUserId
      });
      return {
        kind: "setup",
        responseText: ["SOUL setup started.", formatSoulPersonaQuestion(0)].join("\n"),
        shouldStoreFreeText: false
      };
    }
    await createTelegramPersonaSession(input.workspaceRoot, {
      mode: "setup_artist",
      chatId: input.chatId,
      userId: input.fromUserId
    });
    return {
      kind: "setup",
      responseText: [
        "Artist persona setup started.",
        formatArtistPersonaQuestion(0)
      ].join("\n"),
      shouldStoreFreeText: false
    };
  }

  if (command === "/persona") {
    if (!input.workspaceRoot) {
      return { kind: "persona", responseText: "Persona command unavailable: workspace root missing.", shouldStoreFreeText: false };
    }
    const subcommand = args[0]?.toLowerCase();
    if (subcommand === "fields") {
      return { kind: "persona", responseText: formatPersonaFields(), shouldStoreFreeText: false };
    }
    if (subcommand === "show") {
      return { kind: "persona", responseText: await formatPersonaShow(input.workspaceRoot), shouldStoreFreeText: false };
    }
    if (subcommand === "check") {
      const mode = args[1]?.toLowerCase();
      const report = await auditPersonaCompleteness(input.workspaceRoot);
      if (mode === "fill") {
        const queue = report.fields.filter(needsPersonaFill).map((field) => field.field);
        if (queue.length === 0) {
          return { kind: "persona", responseText: "All fields filled. Use /persona show to review it.", shouldStoreFreeText: false };
        }
        const [field, ...rest] = queue;
        await createTelegramPersonaSession(input.workspaceRoot, {
          mode: "check_fill_chain",
          field,
          checkFillQueue: rest,
          chatId: input.chatId,
          userId: input.fromUserId
        });
        return {
          kind: "persona",
          responseText: [
            formatPersonaCheckSummary(report),
            "",
            `Starting fill chain. First: ${field}. Send the new value, /skip, or /cancel.`
          ].join("\n"),
          shouldStoreFreeText: false
        };
      }
      if (mode === "suggest") {
        return {
          kind: "persona",
          responseText: await formatPersonaSuggestions(report, input.aiReviewProvider),
          shouldStoreFreeText: false
        };
      }
      return { kind: "persona", responseText: formatPersonaCheckReport(report), shouldStoreFreeText: false };
    }
    if (subcommand === "edit") {
      const field = parsePersonaEditField(args[1]);
      if (!field) {
        return {
          kind: "persona",
          responseText: "Usage: /persona edit <field>. Send /persona fields for editable fields.",
          shouldStoreFreeText: false
        };
      }
      await createTelegramPersonaSession(input.workspaceRoot, {
        mode: "edit_field",
        field,
        chatId: input.chatId,
        userId: input.fromUserId
      });
      return {
        kind: "persona",
        responseText: `Editing ${args[1]}. Send the new value, then /confirm or /cancel.`,
        shouldStoreFreeText: false
      };
    }
    if (subcommand === "reset") {
      await createTelegramPersonaSession(input.workspaceRoot, {
        mode: "reset_confirm",
        chatId: input.chatId,
        userId: input.fromUserId
      });
      return {
        kind: "persona",
        responseText: "This will replace Telegram-managed ARTIST/SOUL persona blocks. Reply /confirm reset or /cancel.",
        shouldStoreFreeText: false
      };
    }
    if (subcommand === "migrate") {
      const migrateMatch = text.match(/^\/persona\s+migrate(?:\s+([\s\S]*))?$/i);
      const intent = migrateMatch?.[1]?.trim() || undefined;
      const plan = await planPersonaMigrate(input.workspaceRoot, { intent, aiReviewProvider: input.aiReviewProvider });
      await createTelegramPersonaSession(input.workspaceRoot, {
        mode: "migrate_confirm",
        chatId: input.chatId,
        userId: input.fromUserId,
        migrateIntent: intent,
        migrateAiReviewProvider: input.aiReviewProvider
      });
      return {
        kind: "persona",
        responseText: formatPersonaMigratePlan(plan),
        shouldStoreFreeText: false
      };
    }
    return {
      kind: "persona",
      responseText: "Usage: /persona show | /persona fields | /persona edit <field> | /persona check [fill|suggest] | /persona reset | /persona migrate",
      shouldStoreFreeText: false
    };
  }

  if (command === "/status") {
    return {
      kind: "status",
      responseText: formatStatus(input.autopilotStatus),
      shouldStoreFreeText: false
    };
  }

  if (command === "/songs") {
    if (!input.workspaceRoot) {
      return { kind: "songs", responseText: "Song list unavailable: workspace root missing.", shouldStoreFreeText: false };
    }
    const songs = await listRecentSongs(input.workspaceRoot, 10);
    return {
      kind: "songs",
      responseText: songs.length === 0
        ? "No songs yet."
        : songs.map((song) => `${song.songId} | ${song.status} | ${song.title}`).join("\n"),
      shouldStoreFreeText: false
    };
  }

  if (command === "/song") {
    const songId = args[0];
    if (!input.workspaceRoot || !songId) {
      return { kind: "song", responseText: "Usage: /song <songId>", shouldStoreFreeText: false };
    }
    const song = await getSongDetail(input.workspaceRoot, songId);
    return {
      kind: "song",
      responseText: [
        `${song.songId} | ${song.status} | ${song.title}`,
        song.selectedTakeId ? `Selected take: ${song.selectedTakeId}` : undefined,
        `Imported assets: ${song.importedPaths.length}`,
        song.brief ? `Brief: ${song.brief.slice(0, 240)}` : undefined
      ].filter(Boolean).join("\n"),
      shouldStoreFreeText: false
    };
  }

  if (command === "/regen") {
    const songId = args[0];
    if (!input.workspaceRoot || !songId) {
      return { kind: "regen", responseText: "Usage: /regen <songId>", shouldStoreFreeText: false };
    }
    await storeTelegramInbox(input.workspaceRoot, {
      type: "regen_requested",
      songId,
      fromUserId: input.fromUserId,
      chatId: input.chatId,
      text,
      timestamp: Date.now()
    });
    return {
      kind: "regen",
      responseText: `Queued dry-run regeneration request for ${songId}. No Suno create was started.`,
      shouldStoreFreeText: false
    };
  }

  if (command === "/review") {
    const songId = args[0];
    if (!input.workspaceRoot || !songId) {
      return { kind: "review", responseText: "Usage: /review <songId>", shouldStoreFreeText: false };
    }
    try {
      const material = await readSongMaterial(input.workspaceRoot, songId);
      const result = await reviewSongDebugMaterial(input.workspaceRoot, material, input.aiReviewProvider);
      return { kind: "review", responseText: formatDebugAiReviewResult(result), shouldStoreFreeText: false };
    } catch {
      return {
        kind: "review",
        responseText: `Debug review unavailable for ${songId}: song material was not found.`,
        shouldStoreFreeText: false
      };
    }
  }

  if (command === "/pause") {
    if (!input.workspaceRoot) {
      return { kind: "pause", responseText: "Pause unavailable: workspace root missing.", shouldStoreFreeText: false };
    }
    await new AutopilotControlService().pause(input.workspaceRoot, `telegram:${input.fromUserId}`);
    return { kind: "pause", responseText: "Autopilot paused.", shouldStoreFreeText: false };
  }

  if (command === "/resume") {
    if (!input.workspaceRoot) {
      return { kind: "resume", responseText: "Resume unavailable: workspace root missing.", shouldStoreFreeText: false };
    }
    await new AutopilotControlService().resume(input.workspaceRoot, { reason: `telegram:${input.fromUserId}`, source: "telegram" });
    return { kind: "resume", responseText: "Autopilot resumed.", shouldStoreFreeText: false };
  }

  if (command.startsWith("/")) {
    return {
      kind: "unknown",
      responseText: `Unknown command: ${command}. Send /help for available commands.`,
      shouldStoreFreeText: false
    };
  }

  return {
    kind: "free_text",
    responseText: "Instruction received for local artist inbox staging.",
    shouldStoreFreeText: true
  };
}

function needsPersonaFill(field: PersonaFieldAudit): boolean {
  return field.status === "missing" || field.status === "thin";
}

function formatPersonaCheckSummary(report: Awaited<ReturnType<typeof auditPersonaCompleteness>>): string {
  const needs = report.fields.filter(needsPersonaFill).map((field) => field.field);
  return [
    `Persona check: ${report.summary.filled} filled, ${report.summary.thin} thin, ${report.summary.missing} missing.`,
    needs.length > 0 ? `Needs: ${needs.join(", ")}` : "All fields filled.",
    report.customSections.length > 0 ? `Custom sections: ${report.customSections.join(", ")}` : undefined
  ].filter(Boolean).join("\n");
}

function formatPersonaCheckReport(report: Awaited<ReturnType<typeof auditPersonaCompleteness>>): string {
  const full = formatPersonaAuditReport(report);
  if (full.length <= 1500) {
    return full;
  }
  return formatPersonaCheckSummary(report);
}

async function formatPersonaSuggestions(
  report: Awaited<ReturnType<typeof auditPersonaCompleteness>>,
  provider?: AiReviewProvider
): Promise<string> {
  const reviewer = createDebugAiReviewer(provider);
  const result = await reviewer.review({
    songId: "persona-check",
    title: "Persona check suggestions",
    brief: [
      formatPersonaCheckSummary(report),
      report.customSections.length > 0 ? `Custom sections: ${report.customSections.join(", ")}` : undefined
    ].filter(Boolean).join("\n"),
    takes: []
  });
  return [
    "Persona suggestion mode:",
    result.summary,
    result.provider === "mock" ? "Mock provider placeholder for socialVoice, obsessions, and refusalStyle suggestions." : undefined,
    result.provider === "not_configured" ? "Configure AI provider for suggestions (currently mock)." : undefined
  ].filter(Boolean).join("\n");
}

function formatPersonaFields(): string {
  return [
    "Editable persona fields:",
    "ARTIST: name, identity, sound, themes, lyrics, social",
    "SOUL: soul-tone, soul-refusal"
  ].join("\n");
}

function parsePersonaEditField(value?: string): PersonaField | undefined {
  switch (value?.toLowerCase()) {
    case "name":
      return "artistName";
    case "identity":
      return "identityLine";
    case "sound":
      return "soundDna";
    case "themes":
      return "obsessions";
    case "lyrics":
      return "lyricsRules";
    case "social":
      return "socialVoice";
    case "soul-tone":
      return "soul-tone";
    case "soul-refusal":
      return "soul-refusal";
    default:
      return undefined;
  }
}

async function formatPersonaShow(root: string): Promise<string> {
  const [artist, soul] = await Promise.all([readArtistPersonaSummary(root), readSoulPersonaSummary(root)]);
  const response = [
    `Artist: ${artist.artistName}`,
    `Identity: ${artist.identityLine}`,
    `Sound: ${artist.soundDna}`,
    `Themes: ${artist.obsessions}`,
    `Lyrics guard: ${artist.lyricsRules}`,
    `Social voice: ${artist.socialVoice}`,
    "---",
    `Conversation tone: ${soul.conversationTone || "(not set)"}`,
    `Refusal style: ${soul.refusalStyle || "(not set)"}`
  ].join("\n");
  return response.length > 1600 ? `${response.slice(0, 1597)}...` : response;
}

export function classifyTelegramFreeText(text: string): "pause" | "resume" | "status" | "artist_inbox" {
  const normalized = text.toLowerCase();
  if (normalized.includes("pause")) {
    return "pause";
  }
  if (normalized.includes("resume")) {
    return "resume";
  }
  if (normalized.includes("status")) {
    return "status";
  }
  return "artist_inbox";
}

export async function storeTelegramInbox(root: string, value: Record<string, unknown>): Promise<void> {
  const path = inboxPath(root);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(value)}\n`, "utf8");
}

export async function readTelegramInbox(root: string): Promise<Record<string, unknown>[]> {
  const contents = await readFile(inboxPath(root), "utf8").catch(() => "");
  return contents
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}
