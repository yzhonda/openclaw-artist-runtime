import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { RuntimeEvent } from "./runtimeEventBus.js";

function ledgerPath(root: string): string {
  return join(root, "runtime", "runtime-events.jsonl");
}

export async function appendRuntimeEvent(root: string, event: RuntimeEvent): Promise<RuntimeEvent> {
  const path = ledgerPath(root);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(event)}\n`, "utf8");
  return event;
}

export async function readRuntimeEvents(root: string, limit = 20): Promise<RuntimeEvent[]> {
  const contents = await readFile(ledgerPath(root), "utf8").catch(() => "");
  return contents
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RuntimeEvent)
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, limit);
}
