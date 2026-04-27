import type { AutopilotStage, SunoImportedAssetMetadata } from "../types.js";

export type RuntimeEvent =
  | { type: "autopilot_stage_changed"; songId?: string; from?: AutopilotStage; to: AutopilotStage; timestamp: number }
  | { type: "take_imported"; songId: string; paths: string[]; metadata: SunoImportedAssetMetadata[]; timestamp: number }
  | { type: "autopilot_state_changed"; enabled: boolean; paused: boolean; reason?: string; timestamp: number }
  | { type: "error"; source: string; reason: string; songId?: string; timestamp: number };

export type RuntimeEventHandler = (event: RuntimeEvent) => void | Promise<void>;

export class RuntimeEventBus {
  private readonly handlers = new Set<RuntimeEventHandler>();
  private readonly recentEvents: RuntimeEvent[] = [];

  subscribe(handler: RuntimeEventHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  emit(event: RuntimeEvent): void {
    this.recentEvents.unshift(event);
    this.recentEvents.splice(50);
    for (const handler of this.handlers) {
      void Promise.resolve(handler(event)).catch(() => undefined);
    }
  }

  listRecent(limit = 20): RuntimeEvent[] {
    return this.recentEvents.slice(0, Math.max(0, limit));
  }

  clearForTest(): void {
    this.handlers.clear();
    this.recentEvents.length = 0;
  }
}

const singleton = new RuntimeEventBus();

export function getRuntimeEventBus(): RuntimeEventBus {
  return singleton;
}

export function emitRuntimeEvent(event: RuntimeEvent): void {
  singleton.emit(event);
}
