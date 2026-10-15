import { getMutableConfig } from "../config/store";
import { applyConfig } from "../config/lifecycle";
import * as DB from "../db";
import { showSuccessNotification } from "../states/notifications";
import * as TestLogic from "../test/test-logic";
import {
  clearActiveTags,
  setTagActive,
  saveActiveToLocalStorage,
} from "../collections/tags";
import { saveFullConfigToLocalStorage } from "../config/persistence";
import { getPreset, type PresetItem } from "../collections/presets";
import { untrack } from "solid-js";

export async function apply(_id: string): Promise<void> {
  const snapshot = DB.getSnapshot();
  if (!snapshot) return;

  const presetToApply = untrack(() => getPreset(_id));
  if (presetToApply === undefined) {
    return;
  }

  if (isPartialPreset(presetToApply)) {
    await applyConfig({
      ...structuredClone(getMutableConfig()),
      ...presetToApply.config,
    });
  } else {
    await applyConfig(presetToApply.config);
  }

  if (
    !isPartialPreset(presetToApply) ||
    presetToApply.settingGroups?.includes("behavior")
  ) {
    await clearActiveTags({ noSave: true });
    if (presetToApply.config.tags) {
      for (const tagId of presetToApply.config.tags) {
        await setTagActive({ tagId, active: true });
      }
      saveActiveToLocalStorage();
    }
  }
  void TestLogic.restart();
  showSuccessNotification("Preset applied", { durationMs: 2000 });
  saveFullConfigToLocalStorage();
}

function isPartialPreset(preset: PresetItem): boolean {
  return preset.settingGroups !== undefined && preset.settingGroups !== null;
}
