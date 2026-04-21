import { readFileSync, existsSync } from "node:fs";

const required = [
  "package.json",
  "openclaw.plugin.json",
  "README.md",
  "SECURITY.md",
  "PRIVACY.md",
  "CAPABILITIES.md",
  "CHANGELOG.md",
  "LICENSE"
];

let ok = true;
for (const file of required) {
  if (!existsSync(file)) {
    console.error(`missing required file: ${file}`);
    ok = false;
  }
}

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
if (!pkg.openclaw?.extensions?.length) { console.error("package.json openclaw.extensions is required"); ok = false; }
if (!pkg.openclaw?.compat?.pluginApi) { console.error("package.json openclaw.compat.pluginApi is required"); ok = false; }
if (!pkg.openclaw?.compat?.minGatewayVersion) { console.error("package.json openclaw.compat.minGatewayVersion is required"); ok = false; }

const manifest = JSON.parse(readFileSync("openclaw.plugin.json", "utf8"));
for (const key of ["id", "name", "description", "main", "configSchema"]) {
  if (!(key in manifest)) { console.error(`openclaw.plugin.json ${key} is required`); ok = false; }
}

if (!ok) process.exit(1);
console.log("package verification passed");
