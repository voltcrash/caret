import { psasContract } from "@oxytype/contracts/psas";
import { initServer } from "../hono-adapter";
import * as PsaService from "../../services/operations/psa";
import { callService } from "../ts-rest-adapter";

const s = initServer();
export default s.router(psasContract, {
  get: {
    handler: async (r) => callService(PsaService.getPsas)(r),
  },
});
