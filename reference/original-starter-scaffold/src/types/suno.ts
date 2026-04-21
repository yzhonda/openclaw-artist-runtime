export type SunoPromptPack = {
  songId: string;
  title: string;
  artistReason: string;
  style: { core: string; text: string; coreCharCount: number; totalCharCount: number };
  exclude: { text: string; charCount: number };
  yamlLyrics: { text: string; charCount: number; sourceLyricsVersion: string };
  sliders: { weirdness: number; styleInfluence: number; audioInfluence: number };
  payload: {
    songName: string;
    styleAndFeel: string;
    excludeStyles: string;
    lyrics: string;
    weirdness: number;
    styleInfluence: number;
    audioInfluence: number;
  };
  validation: { passed: boolean; warnings: string[]; errors: string[] };
};

export type SunoRun = {
  runId: string;
  songId: string;
  payloadHash: string;
  status: "prepared" | "filled" | "creating" | "waiting" | "imported" | "failed" | "stopped";
  createdAt: string;
  resultUrls: string[];
  hardStopReason?: string;
};