import { publicContract } from "@oxytype/contracts/public";
import { initServer } from "../hono-adapter";
import * as PublicService from "../../services/operations/public";
import { callService } from "../ts-rest-adapter";

const s = initServer();
export default s.router(publicContract, {
  getSpeedHistogram: {
    handler: async (r) => callService(PublicService.getSpeedHistogram)(r),
  },
  getTypingStats: {
    handler: async (r) => callService(PublicService.getTypingStats)(r),
  },
});
