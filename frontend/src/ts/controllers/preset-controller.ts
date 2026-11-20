import { getMutableConfig } from "../config/store";
import { applyConfig } from "../config/lifecycle";
import * as DB from "../db";
import { showSuccessNotification } from "../states/notifications";
import { restartTest } from "../typing-host";
import {
  clearActiveTags,
  setTagActive,
  saveActiveToLocalStorage,
} from "../../data/collections/tags";
import { saveFullConfigToLocalStorage } from "../config/persistence";
import { getPreset, type PresetItem } from "../../data/collections/presets";
import { untrack } from "solid-js";
import { captureAccount } from "../../app/account-scope";

export async function apply(_id: string): Promise<void> {
  const lease = captureAccount();
  const snapshot = DB.getSnapshot();
  if (!snapshot) return;

  const presetToApply = untrack(() => getPreset(_id));
  if (presetToApply === undefined) {
    return;
  }

  if (isPartialPreset(presetToApply)) {
    await applyConfig(
      {
        ...structuredClone(getMutableConfig()),
        ...presetToApply.config,
      },
      lease,
    );
  } else {
    await applyConfig(presetToApply.config, lease);
  }

  if (
    !isPartialPreset(presetToApply) ||
    presetToApply.settingGroups?.includes("behavior")
  ) {
    await clearActiveTags({ noSave: true });
    lease.assertCurrent();
    if (presetToApply.config.tags) {
      for (const tagId of presetToApply.config.tags) {
        await setTagActive({ tagId, active: true });
        lease.assertCurrent();
      }
      saveActiveToLocalStorage();
    }
  }
  restartTest();
  showSuccessNotification("Preset applied", { durationMs: 2000 });
  saveFullConfigToLocalStorage();
}

function isPartialPreset(preset: PresetItem): boolean {
  return preset.settingGroups !== undefined && preset.settingGroups !== null;
}
