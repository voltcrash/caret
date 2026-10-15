import { configsContract } from "@oxytype/contracts/configs";
import { initServer } from "../hono-adapter";
import * as ConfigService from "../../services/operations/config";
import { callService } from "../ts-rest-adapter";

const s = initServer();

export default s.router(configsContract, {
  get: {
    handler: async (r) => callService(ConfigService.getConfig)(r),
  },
  save: {
    handler: async (r) => callService(ConfigService.saveConfig)(r),
  },
  delete: {
    handler: async (r) => callService(ConfigService.deleteConfig)(r),
  },
});
