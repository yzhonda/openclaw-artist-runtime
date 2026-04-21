// Verify current OpenClaw SDK signatures before implementation.
// This file is intentionally thin so Codex can adapt it to the target OpenClaw version.

import { registerTools } from "./tools/index.js";
import { registerHooks } from "./hooks/index.js";
import { registerServices } from "./services/index.js";
import { registerRoutes } from "./routes/index.js";

export default function registerArtistRuntime(api: unknown): void {
  registerTools(api);
  registerHooks(api);
  registerServices(api);
  registerRoutes(api);
}
