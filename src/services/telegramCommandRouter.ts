export type TelegramCommandKind = "help" | "status" | "unknown" | "free_text";

export interface TelegramRouteInput {
  text: string;
  fromUserId: number;
  chatId: number;
}

export interface TelegramRouteResult {
  kind: TelegramCommandKind;
  responseText: string;
  shouldStoreFreeText: boolean;
}

export function routeTelegramCommand(input: TelegramRouteInput): TelegramRouteResult {
  const text = input.text.trim();
  if (!text) {
    return {
      kind: "unknown",
      responseText: "Send /help for available artist-runtime commands.",
      shouldStoreFreeText: false
    };
  }

  const command = text.split(/\s+/, 1)[0].toLowerCase();
  if (command === "/help" || command === "/start") {
    return {
      kind: "help",
      responseText: ["Available commands:", "/status - show autopilot status", "/help - show this help"].join("\n"),
      shouldStoreFreeText: false
    };
  }

  if (command === "/status") {
    return {
      kind: "status",
      responseText: "artist-runtime Telegram bridge is online. Autopilot command hooks are staged for Phase 3.",
      shouldStoreFreeText: false
    };
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
    responseText: "Instruction received for operator inbox staging. Free-text execution is disabled until Phase 3.",
    shouldStoreFreeText: true
  };
}
