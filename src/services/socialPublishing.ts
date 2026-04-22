import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { applyConfigDefaults } from "../config/schema.js";
import { InstagramConnector } from "../connectors/social/instagramConnector.js";
import type { SocialConnector } from "../connectors/social/SocialConnector.js";
import { TikTokConnector } from "../connectors/social/tiktokConnector.js";
import { XBirdConnector } from "../connectors/social/xBirdConnector.js";
import type { ArtistRuntimeConfig, SocialCapability, SocialPlatform, SocialPublishLedgerEntry, SocialPublishResult, SocialRiskLevel } from "../types.js";
import { updateSongState } from "./artistState.js";
import { appendAuditLog, createAuditEvent, inspectAuditLog } from "./auditLog.js";
import { decideSocialAuthority } from "./socialAuthority.js";

export interface SocialActionInput {
  workspaceRoot: string;
  songId: string;
  platform: SocialPlatform;
  postType: string;
  text?: string;
  mediaPaths?: string[];
  risk?: SocialRiskLevel;
  config?: Partial<ArtistRuntimeConfig>;
  action?: "publish" | "reply";
  targetId?: string;
  targetUrl?: string;
}

function getConnector(platform: SocialPlatform): SocialConnector {
  switch (platform) {
    case "instagram":
      return new InstagramConnector();
    case "tiktok":
      return new TikTokConnector();
    case "x":
    default:
      return new XBirdConnector();
  }
}

function getPlatformAuthority(config: ArtistRuntimeConfig, platform: SocialPlatform) {
  return config.distribution.platforms[platform].authority;
}

function getSocialLedgerPath(root: string, songId: string): string {
  return join(root, "songs", songId, "social", "social-publish.jsonl");
}

function getAuditPath(root: string, songId: string): string {
  return join(root, "songs", songId, "audit", "actions.jsonl");
}

async function appendJsonl<T>(path: string, value: T): Promise<T> {
  const health = await inspectAuditLog(path);
  if (!health.healthy) {
    throw new Error(`jsonl file is unhealthy: ${health.errors.join("; ")}`);
  }
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(value)}\n`, "utf8");
  return value;
}

function hashText(value?: string): string | undefined {
  return value ? createHash("sha256").update(value).digest("hex") : undefined;
}

function capabilityForPostType(capability: SocialCapability, postType: string, action: "publish" | "reply") {
  if (action === "reply") {
    return capability.reply;
  }
  if (postType.includes("carousel")) {
    return capability.carouselPost;
  }
  if (postType.includes("reel")) {
    return capability.reelPost;
  }
  if (postType.includes("video") || postType.includes("clip") || postType.includes("teaser")) {
    return capability.videoPost;
  }
  if (postType.includes("image") || postType.includes("visual") || postType.includes("cover") || postType.includes("card")) {
    return capability.imagePost;
  }
  return capability.textPost;
}

async function readLastJsonlEntry<T>(path: string): Promise<T | undefined> {
  const contents = await readFile(path, "utf8").catch(() => "");
  const lines = contents.split("\n").filter(Boolean);
  if (lines.length === 0) {
    return undefined;
  }
  return JSON.parse(lines.at(-1) as string) as T;
}

export async function readLatestSocialAction(root: string, songId: string): Promise<SocialPublishLedgerEntry | undefined> {
  return readLastJsonlEntry<SocialPublishLedgerEntry>(getSocialLedgerPath(root, songId));
}

export async function publishSocialAction(input: SocialActionInput): Promise<{ result: SocialPublishResult; entry: SocialPublishLedgerEntry }> {
  const action = input.action ?? "publish";
  const config = applyConfigDefaults(input.config);
  const connector = getConnector(input.platform);
  const capabilitySummary = await connector.checkCapabilities();
  const capabilityAvailable = capabilityForPostType(capabilitySummary, input.postType, action);
  const authorityDecision = decideSocialAuthority({
    dryRun: config.autopilot.dryRun,
    authority: getPlatformAuthority(config, input.platform),
    platform: input.platform,
    risk: input.risk ?? "low",
    postType: input.postType,
    requestedAction: action,
    capabilityAvailable
  });

  const result: SocialPublishResult = authorityDecision.allowed
    ? action === "reply"
      ? await (connector.reply?.({
          dryRun: config.autopilot.dryRun,
          authority: getPlatformAuthority(config, input.platform),
          postType: input.postType,
          text: input.text,
          mediaPaths: input.mediaPaths,
          targetId: input.targetId,
          targetUrl: input.targetUrl
        }) ?? Promise.resolve({
          accepted: false,
          platform: input.platform,
          dryRun: config.autopilot.dryRun,
          reason: `${input.platform} reply is unavailable`,
          url: undefined
        }))
      : await connector.publish({
          dryRun: config.autopilot.dryRun,
          authority: getPlatformAuthority(config, input.platform),
          postType: input.postType,
          text: input.text,
          mediaPaths: input.mediaPaths
        })
    : {
        accepted: false,
        platform: input.platform,
        dryRun: config.autopilot.dryRun,
        reason: authorityDecision.reason,
        url: undefined
      };

  const entry: SocialPublishLedgerEntry = {
    timestamp: new Date().toISOString(),
    platform: input.platform,
    connector: connector.id,
    songId: input.songId,
    postType: input.postType,
    action,
    accepted: result.accepted,
    dryRun: config.autopilot.dryRun,
    textHash: hashText(input.text),
    mediaRefs: input.mediaPaths ?? [],
    policyDecision: authorityDecision,
    url: result.url,
    verification: {
      status: result.accepted ? "verified" : "pending",
      detail: result.reason
    },
    error: result.accepted ? undefined : { name: "SocialPublishResult", message: result.reason },
    reason: result.reason
  };

  await appendAuditLog(
    getAuditPath(input.workspaceRoot, input.songId),
    createAuditEvent({
      eventType: action === "reply" ? "social_reply" : "social_publish",
      actor: "connector",
      sourceRefs: input.mediaPaths,
      policyDecision: authorityDecision,
      verification: entry.verification,
      error: entry.error,
      details: {
        platform: input.platform,
        connector: connector.id,
        postType: input.postType,
        url: result.url
      }
    })
  );
  await appendJsonl(getSocialLedgerPath(input.workspaceRoot, input.songId), entry);

  if (action === "publish") {
    await updateSongState(input.workspaceRoot, input.songId, {
      status: result.accepted ? "published" : "social_assets",
      reason: result.reason,
      appendPublicLinks: result.url ? [result.url] : []
    });
  }

  return { result, entry };
}
