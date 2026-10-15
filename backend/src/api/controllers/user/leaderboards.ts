import { adaptService } from "../../service-adapter";
import * as services from "../../../services/operations/user/leaderboards";
export const clearPb = adaptService(services.clearPb);
export const optOutOfLeaderboards = adaptService(services.optOutOfLeaderboards);
export const updateLbMemory = adaptService(services.updateLbMemory);
