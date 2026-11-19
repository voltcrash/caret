import { GetPsaResponse } from "@caret/contracts/psas";
import * as PsaDAL from "../../dal/psa";
import { ApiResponse } from "../../utils/api-response";
import type { ServiceContext, OperationInput } from "../context";
import { PSA } from "@caret/schemas/psas";
import { cacheWithTTL } from "../../utils/ttl-cache";

//cache for one minute
const cache = cacheWithTTL<PSA[]>(1 * 60 * 1000, async () => {
  return await PsaDAL.get();
});

export async function getPsas(
  _context: ServiceContext,
  _input: OperationInput,
): Promise<GetPsaResponse> {
  return new ApiResponse("PSAs retrieved", (await cache()) ?? []);
}
