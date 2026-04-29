import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { resolveSunoDailyBudget } from "./runtimeConfig.js";

export interface SunoDailyBudgetState {
  date: string;
  used: number;
  limit: number;
  updatedAt: string;
}

export interface SunoBudgetConsumeResult {
  ok: boolean;
  state: SunoDailyBudgetState;
  reason?: string;
}

function ledgerPath(root: string): string {
  return join(root, "runtime", "suno-budget-ledger.json");
}

function jstDate(now = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function readRawState(root: string): Promise<Partial<SunoDailyBudgetState> | undefined> {
  const raw = await readFile(ledgerPath(root), "utf8").catch(() => "");
  return raw ? JSON.parse(raw) as Partial<SunoDailyBudgetState> : undefined;
}

async function writeState(root: string, state: SunoDailyBudgetState): Promise<SunoDailyBudgetState> {
  await mkdir(dirname(ledgerPath(root)), { recursive: true });
  await writeFile(ledgerPath(root), `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return state;
}

export async function resetIfNewDay(root: string, now = new Date()): Promise<SunoDailyBudgetState> {
  const date = jstDate(now);
  const limit = await resolveSunoDailyBudget(root);
  const current = await readRawState(root);
  if (!current || current.date !== date) {
    return writeState(root, {
      date,
      used: 0,
      limit,
      updatedAt: now.toISOString()
    });
  }
  const state: SunoDailyBudgetState = {
    date,
    used: Math.max(0, Number(current.used ?? 0)),
    limit,
    updatedAt: now.toISOString()
  };
  return writeState(root, state);
}

export async function readBudgetState(root: string, now = new Date()): Promise<SunoDailyBudgetState> {
  return resetIfNewDay(root, now);
}

export async function tryConsumeBudget(root: string, amount: number, now = new Date()): Promise<SunoBudgetConsumeResult> {
  const normalizedAmount = Math.max(0, amount);
  const state = await resetIfNewDay(root, now);
  if (state.used + normalizedAmount > state.limit) {
    return {
      ok: false,
      state,
      reason: `daily Suno budget exhausted (${state.used}/${state.limit})`
    };
  }
  const next = await writeState(root, {
    ...state,
    used: state.used + normalizedAmount,
    updatedAt: now.toISOString()
  });
  return { ok: true, state: next };
}
