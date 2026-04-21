# Social Connectors Spec

## Platform roles

```txt
X          = public voice, daily words, lyrics, studio notes
Instagram  = visual identity, lyric cards, Reels, cover visuals
TikTok     = short-video discovery, hooks, demo clips, performance feeling
```

## Common interface

```ts
type SocialPlatform = "x" | "instagram" | "tiktok";

type SocialCapability = {
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

interface SocialConnector {
  id: SocialPlatform;
  label: string;
  checkConnection(): Promise<ConnectionStatus>;
  checkCapabilities(): Promise<SocialCapability>;
  publish(input: SocialPublishRequest): Promise<SocialPublishResult>;
  reply?(input: SocialReplyRequest): Promise<SocialPublishResult>;
  fetchReactions?(input: FetchReactionsRequest): Promise<Reaction[]>;
}
```

## Authority levels

```ts
type SocialAuthority =
  | "disabled"
  | "draft_only"
  | "auto_publish"
  | "auto_publish_visuals"
  | "auto_publish_clips"
  | "auto_posts_and_low_risk_replies"
  | "full_social_autonomy";
```

## X via Bird

Default role:

- observations,
- studio notes,
- lyric fragments,
- demo teaser,
- new song link.

Default authority:

```txt
auto_publish
```

Guarded actions:

- replies,
- quote posts,
- DMs,
- criticism response,
- controversial topics,
- official release announcements.

The connector should wrap Bird. It should support:

- check Bird installed,
- check logged-in account,
- publish text,
- publish media if Bird supports it,
- reply if allowed,
- search/fetch if available.

## Instagram

Default role:

- lyric cards,
- cover visuals,
- Reel teasers,
- release visuals.

Default authority:

```txt
auto_publish_visuals
```

but only after account/capability check passes. If capability is unknown, downgrade to `draft_only` and alert.

Required features:

- OAuth/connect flow,
- capability check,
- publish image/video/Reel if supported,
- quota display,
- comments initially disabled or guarded.

## TikTok

Default role:

- short hook clips,
- demo teasers,
- behind-the-song snippets.

Default authority:

```txt
auto_publish_clips
```

but only if direct public posting capability is confirmed. Otherwise produce clips/captions and mark publish unavailable.

Required features:

- OAuth/connect flow,
- capability check,
- direct post or upload flow,
- creator info check,
- caption/hashtag generation,
- comments initially disabled or guarded.

## Content pipeline

A selected Suno take creates a distribution set:

```txt
DistributionSet
  sourceSongId
  sourceTakeId
  assets:
    xPost
    instagramLyricCard
    instagramReel
    tiktokHookClip
  decisions:
    policyDecision per asset
  results:
    publishUrl per asset
```

## Public action log

Every publish result must append:

- platform,
- connector,
- account,
- post type,
- source song/take,
- text/caption hash,
- media file refs,
- policy decision,
- URL or failure,
- verification status.