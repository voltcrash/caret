import { adaptService } from "../service-adapter";
import * as services from "../../services/operations/configuration";
export const getConfiguration = adaptService(services.getConfiguration);
export const getSchema = adaptService(services.getSchema);
export const updateConfiguration = adaptService(services.updateConfiguration);
