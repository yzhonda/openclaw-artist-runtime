import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const DEFAULT_SUNO_DAILY_CREDIT_LIMIT = 60;
export const DEFAULT_SUNO_LIVE_CREATE_CREDIT_COST = 10;
export const SUNO_BUDGET_EXHAUSTED_REASON = "budget_exhausted";

type BudgetState = {
  date: string;
  consumed: number;
};

type ReserveResult = {
  ok: boolean;
  consumed: number;
  limit: number;
};

export type SunoBudgetState = {
  date: string;
  consumed: number;
  limit: number;
  remaining: number;
};

function utcDate(clock: () => Date): string {
  return clock().toISOString().slice(0, 10);
}

export class SunoBudgetTracker {
  constructor(
    private readonly workspaceRoot = ".",
    private readonly clock: () => Date = () => new Date()
  ) {}

  private statePath(): string {
    return join(this.workspaceRoot, "runtime", "suno", "budget.json");
  }

  private emptyState(): BudgetState {
    return {
      date: utcDate(this.clock),
      consumed: 0
    };
  }

  private async readState(): Promise<BudgetState> {
    const contents = await readFile(this.statePath(), "utf8").catch(() => "");
    if (!contents) {
      return this.emptyState();
    }

    let parsed: Partial<BudgetState>;
    try {
      parsed = JSON.parse(contents) as Partial<BudgetState>;
    } catch {
      return this.emptyState();
    }
    return {
      date: typeof parsed.date === "string" ? parsed.date : utcDate(this.clock),
      consumed: Number.isFinite(parsed.consumed) ? Number(parsed.consumed) : 0
    };
  }

  private async writeState(state: BudgetState): Promise<void> {
    await mkdir(dirname(this.statePath()), { recursive: true });
    await writeFile(this.statePath(), `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }

  async reserve(credits: number, limit = DEFAULT_SUNO_DAILY_CREDIT_LIMIT): Promise<ReserveResult> {
    const today = utcDate(this.clock);
    const current = await this.readState();
    const normalized = current.date === today
      ? current
      : {
          date: today,
          consumed: 0
        };

    if (normalized.consumed + credits > limit) {
      return {
        ok: false,
        consumed: normalized.consumed,
        limit
      };
    }

    const next = {
      date: today,
      consumed: normalized.consumed + credits
    };
    await this.writeState(next);
    return {
      ok: true,
      consumed: next.consumed,
      limit
    };
  }

  async getState(limit = DEFAULT_SUNO_DAILY_CREDIT_LIMIT): Promise<SunoBudgetState> {
    const today = utcDate(this.clock);
    const current = await this.readState();
    const normalized = current.date === today
      ? current
      : {
          date: today,
          consumed: 0
        };

    return {
      date: normalized.date,
      consumed: normalized.consumed,
      limit,
      remaining: Math.max(limit - normalized.consumed, 0)
    };
  }
}
