import { adaptService } from "../service-adapter";
import * as services from "../../services/operations/preset";
export const getPresets = adaptService(services.getPresets);
export const addPreset = adaptService(services.addPreset);
export const editPreset = adaptService(services.editPreset);
export const removePreset = adaptService(services.removePreset);
