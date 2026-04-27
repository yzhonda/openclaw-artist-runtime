// Verify current OpenClaw SDK signatures before implementation.
// This file is intentionally thin so Codex can adapt it to the target OpenClaw version.

import { registerTools } from "./tools/index.js";
import { registerHooks } from "./hooks/index.js";
import { registerServices } from "./services/index.js";
import { registerRoutes } from "./routes/index.js";
import { registerCommands } from "./commands/index.js";

interface PluginCommandSpecLike {
  name?: string;
}

function logTelegramCommandSpecs(api: unknown): void {
  const getPluginCommandSpecs = typeof api === "object" && api !== null
    ? (api as { getPluginCommandSpecs?: (provider?: string) => PluginCommandSpecLike[] }).getPluginCommandSpecs
    : undefined;
  if (typeof getPluginCommandSpecs !== "function") {
    return;
  }
  try {
    const specs = getPluginCommandSpecs("telegram");
    const names = specs.map((spec) => spec.name).filter((name): name is string => typeof name === "string" && name.length > 0);
    console.info(`[artist-runtime] telegram plugin command specs: ${names.join(",") || "(none)"} (count=${names.length}, persona=${names.includes("persona")})`);
  } catch (error) {
    console.warn(`[artist-runtime] telegram plugin command specs unavailable: ${String(error)}`);
  }
}

export default function registerArtistRuntime(api: unknown): void {
  registerTools(api);
  registerHooks(api);
  registerServices(api);
  registerRoutes(api);
  registerCommands(api);
  logTelegramCommandSpecs(api);
}
