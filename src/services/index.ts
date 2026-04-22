import { safeRegisterService } from "../pluginApi.js";
import { ArtistAutopilotService } from "./autopilotService.js";
import { getAutopilotTicker } from "./autopilotTicker.js";
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

  safeRegisterService(api, {
    name: "autopilotTicker",
    create: () => getAutopilotTicker()
  });
}
