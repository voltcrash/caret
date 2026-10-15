import { adaptService } from "../service-adapter";
import * as services from "../../services/operations/public";
export const getSpeedHistogram = adaptService(services.getSpeedHistogram);
export const getTypingStats = adaptService(services.getTypingStats);
