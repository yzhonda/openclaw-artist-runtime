import type { SocialCapability, SocialPublishRequest, SocialPublishResult } from "../../types/social.js";

export interface SocialConnector {
  id: "x" | "instagram" | "tiktok";
  label: string;
  checkConnection(): Promise<{ ok: boolean; account?: string; message?: string }>;
  checkCapabilities(): Promise<SocialCapability>;
  publish(input: SocialPublishRequest): Promise<SocialPublishResult>;
}