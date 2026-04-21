import { promises as fs } from "node:fs";
import path from "node:path";

export class SongRepository {
  constructor(private readonly workspacePath: string) {}

  songDir(songId: string): string {
    return path.join(this.workspacePath, "songs", songId);
  }

  async ensureSong(songId: string): Promise<string> {
    const dir = this.songDir(songId);
    await fs.mkdir(path.join(dir, "lyrics"), { recursive: true });
    await fs.mkdir(path.join(dir, "suno", "takes"), { recursive: true });
    await fs.mkdir(path.join(dir, "prompts"), { recursive: true });
    await fs.mkdir(path.join(dir, "social"), { recursive: true });
    await fs.mkdir(path.join(dir, "audit"), { recursive: true });
    return dir;
  }
}