import type { SunoDailyBudgetState } from "./sunoBudgetLedger.js";
import { readBudgetState, tryConsumeBudget } from "./sunoBudgetLedger.js";

export interface SunoBudgetGuardResult {
  ok: boolean;
  state: SunoDailyBudgetState;
  remaining: number;
  reason?: string;
}

export async function reserveSunoGenerationBudget(root: string, amount = 1, now = new Date()): Promise<SunoBudgetGuardResult> {
  const current = await readBudgetState(root, now);
  const remaining = Math.max(0, current.limit - current.used);
  if (remaining < amount) {
    return {
      ok: false,
      state: current,
      remaining,
      reason: `daily Suno budget exhausted; budget low (${current.used}/${current.limit})`
    };
  }
  const consumed = await tryConsumeBudget(root, amount, now);
  return {
    ok: consumed.ok,
    state: consumed.state,
    remaining: Math.max(0, consumed.state.limit - consumed.state.used),
    reason: consumed.reason
  };
}
