#!/usr/bin/env node
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

export const forbiddenPatterns = [
  { id: "suno-password-assignment", pattern: /\bSUNO_PASSWORD\s*=/i },
  { id: "instagram-password-assignment", pattern: /\bINSTAGRAM_PASSWORD\s*=/i },
  { id: "tiktok-token-assignment", pattern: /\bTIKTOK_ACCESS_TOKEN\s*=/i },
  { id: "oauth-token-literal", pattern: /\boauth_token_[A-Za-z0-9_-]+/i },
  { id: "bearer-header-literal", pattern: /\bauthorization\s*:\s*bearer\s+["'`]?[A-Za-z0-9._-]{12,}/i },
  { id: "sensitive-console-dump", pattern: /\bconsole\.(?:log|warn|error)\([^)]*(?:token|secret|password|cookie|authorization)/i },
  { id: "hardcoded-env-fallback", pattern: /process\.env\.[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|COOKIE)\s*\|\|\s*["'`][^"'`\s]+/ },
  { id: "absolute-env-path", pattern: /\/Users\/[^"'`\s]+\/[^"'`\s]*\.env(?:\.[^"'`\s]+)?/ },
  { id: "document-cookie-access", pattern: /\bdocument\.cookie\b/ },
  { id: "profile-cookie-copy", pattern: /openclaw-browser-profiles\/suno\/.*(?:cookie|session|token)/i }
];

const defaultRoots = ["src", "tests"];
const textExtensions = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".json",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx"
]);

function extensionOf(path) {
  const index = path.lastIndexOf(".");
  return index === -1 ? "" : path.slice(index);
}

async function collectFiles(root) {
  if (!existsSync(root)) {
    return [];
  }

  const entry = await stat(root);
  if (entry.isFile()) {
    return textExtensions.has(extensionOf(root)) ? [root] : [];
  }
  if (!entry.isDirectory()) {
    return [];
  }

  const files = [];
  const children = await readdir(root, { withFileTypes: true });
  for (const child of children) {
    if (child.name === "node_modules" || child.name === "dist" || child.name === "coverage" || child.name === ".git") {
      continue;
    }
    files.push(...await collectFiles(join(root, child.name)));
  }
  return files;
}

export async function scanBoundaryPatterns({ cwd = process.cwd(), roots = defaultRoots } = {}) {
  const findings = [];
  const files = (await Promise.all(roots.map((root) => collectFiles(join(cwd, root))))).flat();

  for (const file of files) {
    const contents = await readFile(file, "utf8");
    const lines = contents.split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      for (const rule of forbiddenPatterns) {
        if (rule.pattern.test(line)) {
          findings.push({
            rule: rule.id,
            file: relative(cwd, file),
            line: index + 1,
            text: line.trim()
          });
        }
      }
    }
  }

  return findings;
}

function parseArgs(argv) {
  const roots = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--root") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error("--root requires a path");
      }
      roots.push(next);
      index += 1;
    } else {
      roots.push(value);
    }
  }
  return roots.length > 0 ? roots : defaultRoots;
}

async function main() {
  const roots = parseArgs(process.argv.slice(2));
  const findings = await scanBoundaryPatterns({ roots });

  if (findings.length > 0) {
    for (const finding of findings) {
      console.error(`${finding.file}:${finding.line} [${finding.rule}] ${finding.text}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`boundary-grep passed (${roots.join(", ")})`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

