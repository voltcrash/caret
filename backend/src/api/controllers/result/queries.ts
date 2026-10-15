import { adaptService } from "../../service-adapter";
import * as services from "../../../services/operations/result/queries";
export const getResults = adaptService(services.getResults);
export const getResultById = adaptService(services.getResultById);
export const getLastResult = adaptService(services.getLastResult);
export const updateTags = adaptService(services.updateTags);
