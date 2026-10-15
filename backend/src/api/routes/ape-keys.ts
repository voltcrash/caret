import { apeKeysContract } from "@oxytype/contracts/ape-keys";
import { initServer } from "../hono-adapter";
import * as ApeKeyService from "../../services/operations/ape-key";
import { callService } from "../ts-rest-adapter";

const s = initServer();
export default s.router(apeKeysContract, {
  get: {
    handler: async (r) => callService(ApeKeyService.getApeKeys)(r),
  },
  add: {
    handler: async (r) => callService(ApeKeyService.generateApeKey)(r),
  },
  save: {
    handler: async (r) => callService(ApeKeyService.editApeKey)(r),
  },
  delete: {
    handler: async (r) => callService(ApeKeyService.deleteApeKey)(r),
  },
});
