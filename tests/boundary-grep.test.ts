import { mkdir, writeFile } from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scanBoundaryPatterns } from "../scripts/boundary-grep.mjs";

async function writeFixture(root: string, relativePath: string, contents: string): Promise<void> {
  const target = join(root, relativePath);
  await mkdir(join(target, ".."), { recursive: true });
  await writeFile(target, contents, "utf8");
}

describe("boundary-grep", () => {
  it("detects forbidden credential assignment patterns", async () => {
    const root = mkdtempSync(join(tmpdir(), "artist-runtime-boundary-grep-hit-"));
    await writeFixture(root, "src/leak.ts", `const leaked = "${"SUNO_" + "PASSWORD="}real-value";\n`);

    const findings = await scanBoundaryPatterns({ cwd: root, roots: ["src"] });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      file: "src/leak.ts",
      line: 1,
      rule: "suno-password-assignment"
    });
  });

  it("passes clean source and test files", async () => {
    const root = mkdtempSync(join(tmpdir(), "artist-runtime-boundary-grep-clean-"));
    await writeFixture(root, "src/index.ts", "export const status = 'ok';\n");
    await writeFixture(root, "tests/index.test.ts", "expect('ok').toBe('ok');\n");

    const findings = await scanBoundaryPatterns({ cwd: root, roots: ["src", "tests"] });

    expect(findings).toEqual([]);
  });

  it("does not flag safe environment-variable names without inline secret assignment", async () => {
    const root = mkdtempSync(join(tmpdir(), "artist-runtime-boundary-grep-safe-env-"));
    await writeFixture(
      root,
      "tests/env.test.ts",
      [
        `vi.stubEnv("${"OPENCLAW_" + "TIKTOK_ACCESS_TOKEN"}", "configured-token");`,
        "const token = process.env[name]?.trim();"
      ].join("\n")
    );

    const findings = await scanBoundaryPatterns({ cwd: root, roots: ["tests"] });

    expect(findings).toEqual([]);
  });
});

