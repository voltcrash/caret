import { devContract } from "@oxytype/contracts/dev";
import { initServer } from "../hono-adapter";

import * as DevService from "../../services/operations/dev";
import { callService } from "../ts-rest-adapter";
import { onlyAvailableOnDev } from "../../middlewares/utility";

const s = initServer();

export default s.router(devContract, {
  generateData: {
    middleware: [onlyAvailableOnDev()],
    handler: async (r) => callService(DevService.createTestData)(r),
  },
  addDebugInboxItem: {
    middleware: [onlyAvailableOnDev()],
    handler: async (r) => callService(DevService.addDebugInboxItem)(r),
  },
});
