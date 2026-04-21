// Verify current OpenClaw SDK imports before implementing.
// This file intentionally uses the documented focused plugin-entry subpath.
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

import { registerHooks } from "./hooks/index.js";
import { registerRoutes } from "./routes/index.js";
import { registerTools } from "./tools/index.js";

export default definePluginEntry({
  id: "artist-runtime",
  name: "Artist Runtime",
  description: "Runs an OpenClaw agent as a public autonomous musical artist.",
  register(api) {
    registerRoutes(api);
    registerTools(api);
    registerHooks(api);
    // TODO: register services after verifying current OpenClaw service API.
  },
});