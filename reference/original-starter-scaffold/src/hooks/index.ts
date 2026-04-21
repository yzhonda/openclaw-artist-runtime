import { registerBootstrapArtistHook } from "./bootstrapArtist.js";
import { registerSocialApprovalGuard } from "./socialApprovalGuard.js";

export function registerHooks(api: any): void {
  registerBootstrapArtistHook(api);
  registerSocialApprovalGuard(api);
}