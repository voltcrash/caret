import { adaptService } from "../service-adapter";
import * as services from "../../services/operations/config";
export const getConfig = adaptService(services.getConfig);
export const saveConfig = adaptService(services.saveConfig);
export const deleteConfig = adaptService(services.deleteConfig);
