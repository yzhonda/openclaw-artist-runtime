import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { AutopilotStatus } from "../types.js";
import { AutopilotControlService } from "./autopilotControlService.js";
import { getSongDetail, listRecentSongs } from "./songQueryService.js";

export type TelegramCommandKind = "help" | "status" | "songs" | "song" | "regen" | "pause" | "resume" | "unknown" | "free_text";

export interface TelegramRouteInput {
  text: string;
  fromUserId: number;
  chatId: number;
  workspaceRoot?: string;
  autopilotStatus?: AutopilotStatus;
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
        "/pause - pause autopilot",
        "/resume - resume autopilot",
        "/help - show this help"
      ].join("\n"),
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
