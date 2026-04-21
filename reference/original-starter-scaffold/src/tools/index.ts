import { registerSongTools } from "./songTools.js";
import { registerSunoTools } from "./sunoTools.js";
import { registerSocialTools } from "./socialTools.js";

export function registerTools(api: any): void {
  registerSongTools(api);
  registerSunoTools(api);
  registerSocialTools(api);
}