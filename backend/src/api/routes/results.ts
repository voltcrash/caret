import { resultsContract } from "@oxytype/contracts/results";
import { initServer } from "../hono-adapter";
import * as ResultService from "../../services/operations/result";
import { callService } from "../ts-rest-adapter";

const s = initServer();
export default s.router(resultsContract, {
  get: {
    handler: async (r) => callService(ResultService.getResults)(r),
  },
  getById: {
    handler: async (r) => callService(ResultService.getResultById)(r),
  },
  add: {
    handler: async (r) => callService(ResultService.addResult)(r),
  },
  updateTags: {
    handler: async (r) => callService(ResultService.updateTags)(r),
  },
  getLast: {
    handler: async (r) => callService(ResultService.getLastResult)(r),
  },
});
