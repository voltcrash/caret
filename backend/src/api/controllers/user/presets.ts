import { adaptService } from "../../service-adapter";
import * as services from "../../../services/operations/user/presets";
export const addResultFilterPreset = adaptService(
  services.addResultFilterPreset,
);
export const removeResultFilterPreset = adaptService(
  services.removeResultFilterPreset,
);
