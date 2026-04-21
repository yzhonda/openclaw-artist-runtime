import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { PromptLedgerEntry } from "../types/ledger.js";

export function sha256(text: string): string {
  return "sha256:" + crypto.createHash("sha256").update(text).digest("hex");
}

export class PromptLedgerService {
  async append(filePath: string, entry: Omit<PromptLedgerEntry, "id" | "timestamp">): Promise<PromptLedgerEntry> {
    const full: PromptLedgerEntry = {
      id: `pl_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.appendFile(filePath, JSON.stringify(full) + "\n", "utf8");
    return full;
  }
}