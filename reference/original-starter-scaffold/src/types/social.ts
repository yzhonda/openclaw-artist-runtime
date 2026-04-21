export type SocialPlatform = "x" | "instagram" | "tiktok";

export type SocialPostType =
  | "observation"
  | "studio_note"
  | "lyric_fragment"
  | "demo_teaser"
  | "new_song_link"
  | "lyric_card"
  | "reel_teaser"
  | "hook_clip"
  | "release_announcement";

export type SocialCapability = {
  textPost: boolean;
  imagePost: boolean;
  videoPost: boolean;
  carouselPost: boolean;
  reelPost: boolean | "unknown";
  reply: boolean;
  quote: boolean;
  dm: boolean;
  scheduledPost: boolean;
  metrics: boolean;
};

export type SocialPublishRequest = {
  platform: SocialPlatform;
  postType: SocialPostType;
  text?: string;
  caption?: string;
  mediaPaths?: string[];
  sourceSongId?: string;
  sourceTakeId?: string;
  artistReason: string;
  runId: string;
};

export type SocialPublishResult = {
  ok: boolean;
  platform: SocialPlatform;
  url?: string;
  externalId?: string;
  error?: string;
  verified: boolean;
};