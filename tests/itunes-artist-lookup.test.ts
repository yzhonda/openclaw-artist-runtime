import { describe, expect, it, vi } from "vitest";
import { findITunesTrack, lookupITunesArtistTracks, normalizeSongTitle } from "../src/services/itunesArtistLookup";

describe("iTunes artist lookup", () => {
  it("fetches used::honda track metadata and matches normalized titles", async () => {
    const fetchImpl = vi.fn(async () => ({
      text: async () => JSON.stringify({
        results: [
          { wrapperType: "artist", artistName: "used::honda" },
          { wrapperType: "track", trackName: "Where It Played", trackViewUrl: "https://music.apple.com/jp/song/where-it-played/1", releaseDate: "2026-04-01T00:00:00Z" }
        ]
      })
    })) as unknown as typeof fetch;

    const tracks = await lookupITunesArtistTracks({ fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining("id=1889924232&entity=song&limit=200&country=jp"));
    expect(tracks).toEqual([{ title: "Where It Played", url: "https://music.apple.com/jp/song/where-it-played/1", releaseDate: "2026-04-01T00:00:00Z" }]);
    expect(findITunesTrack("where it played", tracks)?.url).toContain("music.apple.com");
    expect(normalizeSongTitle("Where-It Played!")).toBe("where it played");
  });

  it("rejects secret-like lookup responses", async () => {
    const fetchImpl = vi.fn(async () => ({ text: async () => "CREDENTIAL marker should not pass" })) as unknown as typeof fetch;
    await expect(lookupITunesArtistTracks({ fetchImpl })).rejects.toThrow("itunes_response_contains_secret_like_text");
  });
});
