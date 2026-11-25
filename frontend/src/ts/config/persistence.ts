import { onCleanup } from "solid-js";
import { createAccountOwned, captureAccount } from "../../app/account-scope";
import { Config as ConfigSchema } from "@caret/schemas/configs";
import { isAuthenticated } from "../states/core";
import { trackAccountWork } from "../states/header";
import { peekConfig } from "./store";
import * as ConfigSchemas from "@caret/schemas/configs";
import { getDefaultConfig } from "../constants/default-config";
import { migrateConfig } from "./utils";
import { LocalStorageWithSchema } from "../utils/local-storage-with-schema";
import { isObject } from "../utils/misc";
import { debounce } from "@caret/util/timing";
import { setProperty } from "@caret/util/objects";
import { refreshTypingPreviewSettings } from "./typing-preview.client";

const pendingSync = createAccountOwned(() => {
  const current = {
    config: {} as Partial<ConfigSchemas.Config>,
    save: debounce(1000, () => {
      const pending = current.config;
      current.config = {};
      if (Object.keys(pending).length > 0) persist(pending);
    }),
  };
  onCleanup(() => current.save.cancel());
  return current;
});

function persist(config: Partial<ConfigSchemas.Config>): void {
  if (!isAuthenticated()) return;
  const lease = captureAccount();
  void trackAccountWork(async () => {
    const { saveConfig } = await import("./sync");
    await saveConfig(config);
  }).catch((error: unknown) => {
    if (lease.isCurrent()) console.error("Failed to save config", error);
  });
}

export const configLS = new LocalStorageWithSchema({
  key: "config",
  schema: ConfigSchemas.ConfigSchema,
  fallback: getDefaultConfig(),
  migrate: (value, _issues) => {
    if (!isObject(value)) {
      return getDefaultConfig();
    }
    //todo maybe send a full config to db so that it removes legacy values
    return migrateConfig(value);
  },
});

export function saveToLocalStorage(
  key: keyof ConfigSchema,
  nosave = false,
  noDbCheck = false,
): void {
  if (nosave) return;
  configLS.set(peekConfig());
  refreshTypingPreviewSettings(peekConfig());
  if (!noDbCheck) {
    setProperty(pendingSync().config, key, peekConfig()[key]);
    pendingSync().save();
  }
}

export function saveFullConfigToLocalStorage(noDbCheck = false): void {
  console.log("saving full config to localStorage");
  configLS.set(peekConfig());
  refreshTypingPreviewSettings(peekConfig());
  if (!noDbCheck) {
    persist(structuredClone(peekConfig()));
  }
}

export function resetPendingConfigSync(
  newConfigToSend: Partial<ConfigSchemas.Config>,
): void {
  pendingSync().save.cancel({ upcomingOnly: true });
  pendingSync().config = newConfigToSend;
}
