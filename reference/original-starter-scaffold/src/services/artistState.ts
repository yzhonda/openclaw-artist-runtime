import { promises as fs } from "node:fs";
import path from "node:path";

export class ArtistStateService {
  constructor(private readonly workspacePath: string) {}

  async readText(relativePath: string): Promise<string> {
    return fs.readFile(path.join(this.workspacePath, relativePath), "utf8");
  }

  async writeText(relativePath: string, text: string): Promise<void> {
    const p = path.join(this.workspacePath, relativePath);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, text, "utf8");
  }

  async ensureWorkspace(): Promise<void> {
    await fs.mkdir(this.workspacePath, { recursive: true });
    // TODO: copy workspace-template files if missing.
  }
}