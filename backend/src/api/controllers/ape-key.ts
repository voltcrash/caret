import { adaptService } from "../service-adapter";
import * as services from "../../services/operations/ape-key";
export const getApeKeys = adaptService(services.getApeKeys);
export const generateApeKey = adaptService(services.generateApeKey);
export const editApeKey = adaptService(services.editApeKey);
export const deleteApeKey = adaptService(services.deleteApeKey);
