export interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

export interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
}

export interface TelegramChat {
  id: number;
  type?: string;
}

export interface TelegramMessage {
  message_id: number;
  text?: string;
  chat: TelegramChat;
  from?: TelegramUser;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export interface TelegramSendMessageOptions {
  parseMode?: "Markdown" | "MarkdownV2" | "HTML";
  disableNotification?: boolean;
}

export type TelegramFetch = (input: string, init: RequestInit) => Promise<Response>;

export class TelegramClient {
  private readonly baseUrl: string;

  constructor(
    token: string,
    private readonly fetchImpl: TelegramFetch = fetch
  ) {
    const trimmed = token.trim();
    if (!trimmed) {
      throw new Error("telegram token is required");
    }
    this.baseUrl = `https://api.telegram.org/bot${trimmed}`;
  }

  async getUpdates(offset?: number): Promise<TelegramUpdate[]> {
    const payload: Record<string, unknown> = {
      timeout: 25,
      allowed_updates: ["message"]
    };
    if (offset !== undefined) {
      payload.offset = offset;
    }
    return this.call<TelegramUpdate[]>("getUpdates", payload);
  }

  async sendMessage(chatId: number | string, text: string, options: TelegramSendMessageOptions = {}): Promise<TelegramMessage> {
    return this.call<TelegramMessage>("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: options.parseMode,
      disable_notification: options.disableNotification
    });
  }

  private async call<T>(method: string, payload: Record<string, unknown>): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}/${method}`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error(`telegram_${method}_http_${response.status}`);
    }

    const body = (await response.json()) as TelegramApiResponse<T>;
    if (!body.ok || body.result === undefined) {
      throw new Error(body.description ?? `telegram_${method}_failed`);
    }
    return body.result;
  }
}
