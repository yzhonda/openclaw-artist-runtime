import { readFile } from "node:fs/promises";
import type { DistributionEvent, PlatformStat, SocialPlatform, SocialPublishLedgerEntry } from "../types.js";
import { listSongStates } from "./artistState.js";
import { getSocialLedgerArchivePath, getSocialLedgerPath } from "./socialPublishLedger.js";

const PLATFORMS: SocialPlatform[] = ["x", "instagram", "tiktok"];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface DistributionLedgerReadOptions {
  includeArchive?: boolean;
}

async function readJsonlEntries<T>(path: string): Promise<T[]> {
  const contents = await readFile(path, "utf8").catch(() => "");
  if (!contents) {
    return [];
  }
  return contents
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildWindowKeys(now: Date): string[] {
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(now.getTime() - (6 - index) * MS_PER_DAY);
    return dayKey(day);
  });
}

export async function readDistributionEvents(root: string, limit = 20, options: DistributionLedgerReadOptions = {}): Promise<DistributionEvent[]> {
  const songs = await listSongStates(root);
  const all = await Promise.all(
    songs.map(async (song) => {
      const active = await readJsonlEntries<SocialPublishLedgerEntry>(getSocialLedgerPath(root, song.songId));
      const archive = options.includeArchive
        ? await readJsonlEntries<SocialPublishLedgerEntry>(getSocialLedgerArchivePath(root, song.songId))
        : [];
      const entries = [...active, ...archive];
      return entries.map((entry) => ({
        ...entry,
        songId: entry.songId || song.songId
      }));
    })
  );

  return all
    .flat()
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    .slice(0, limit);
}

export async function buildPlatformStats(root: string, now = new Date(), options: DistributionLedgerReadOptions = {}): Promise<Record<SocialPlatform, PlatformStat>> {
  const windowKeys = buildWindowKeys(now);
  const earliest = new Date(`${windowKeys[0]}T00:00:00.000Z`).getTime();
  const events = (await readDistributionEvents(root, Number.MAX_SAFE_INTEGER, options))
    .filter((event) => {
      const timestamp = Date.parse(event.timestamp);
      return Number.isFinite(timestamp) && timestamp >= earliest && timestamp <= now.getTime();
    });

  const stats = Object.fromEntries(PLATFORMS.map((platform) => [
    platform,
    {
      platform,
      count7d: 0,
      accepted7d: 0,
      successRate: 0,
      failedReasons: {},
      dailyCounts: Array.from({ length: 7 }, () => 0)
    } satisfies PlatformStat
  ])) as Record<SocialPlatform, PlatformStat>;

  for (const event of events) {
    const stat = stats[event.platform];
    stat.count7d += 1;
    if (event.accepted) {
      stat.accepted7d += 1;
    } else {
      stat.failedReasons[event.reason] = (stat.failedReasons[event.reason] ?? 0) + 1;
    }

    const index = windowKeys.indexOf(event.timestamp.slice(0, 10));
    if (index >= 0) {
      stat.dailyCounts[index] += 1;
    }
  }

  for (const stat of Object.values(stats)) {
    stat.successRate = stat.count7d > 0 ? stat.accepted7d / stat.count7d : 0;
  }

  return stats;
}
