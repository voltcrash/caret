import { configurationContract } from "@oxytype/contracts/configuration";
import { initServer } from "../hono-adapter";
import * as ConfigurationService from "../../services/operations/configuration";
import { callService } from "../ts-rest-adapter";

const s = initServer();

export default s.router(configurationContract, {
  get: {
    handler: async (r) => callService(ConfigurationService.getConfiguration)(r),
  },
  update: {
    handler: async (r) =>
      callService(ConfigurationService.updateConfiguration)(r),
  },
  getSchema: {
    handler: async (r) => callService(ConfigurationService.getSchema)(r),
  },
});
