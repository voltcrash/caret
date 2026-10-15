import { presetsContract } from "@oxytype/contracts/presets";
import { initServer } from "../hono-adapter";
import * as PresetService from "../../services/operations/preset";
import { callService } from "../ts-rest-adapter";

const s = initServer();
export default s.router(presetsContract, {
  get: {
    handler: async (r) => callService(PresetService.getPresets)(r),
  },
  add: {
    handler: async (r) => callService(PresetService.addPreset)(r),
  },
  save: {
    handler: async (r) => callService(PresetService.editPreset)(r),
  },
  delete: {
    handler: async (r) => callService(PresetService.removePreset)(r),
  },
});
