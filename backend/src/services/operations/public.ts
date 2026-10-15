import type { ClientQuery } from "@oxytype/schemas/shared";
import {
  GetSpeedHistogramQuery,
  GetSpeedHistogramResponse,
  GetTypingStatsResponse,
} from "@oxytype/contracts/public";
import * as PublicDAL from "../../dal/public";
import { MonkeyResponse } from "../../utils/monkey-response";
import { type ServiceContext, type OperationInput } from "../context";

export async function getSpeedHistogram(
  _context: ServiceContext,
  input: OperationInput<GetSpeedHistogramQuery>,
): Promise<GetSpeedHistogramResponse> {
  const { language, mode, mode2 } = input.query;
  const data = await PublicDAL.getSpeedHistogram(
    language,
    mode,
    mode2,
    input.query.client,
  );
  return new MonkeyResponse("Public speed histogram retrieved", data);
}

export async function getTypingStats(
  _context: ServiceContext,
  input: OperationInput<ClientQuery>,
): Promise<GetTypingStatsResponse> {
  const data = await PublicDAL.getTypingStats(input.query?.client);
  return new MonkeyResponse("Public typing stats retrieved", data);
}
