import { safeRegisterService } from "../pluginApi.js";
import { ArtistAutopilotService } from "./autopilotService.js";
import { SocialDistributionWorker } from "./socialDistributionWorker.js";
import { SunoBrowserWorker } from "./sunoBrowserWorker.js";

export function registerServices(api: unknown): void {
  safeRegisterService(api, {
    name: "artistAutopilotService",
    create: () => new ArtistAutopilotService()
  });

  safeRegisterService(api, {
    name: "sunoBrowserWorker",
    create: () => new SunoBrowserWorker()
  });

  safeRegisterService(api, {
    name: "socialDistributionWorker",
    create: () => new SocialDistributionWorker()
  });
}
