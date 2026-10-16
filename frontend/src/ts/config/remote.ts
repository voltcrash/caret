import { operation } from "../../data/operations";
import { captureAccount } from "../../app/account-scope";
import * as ConfigSchemas from "@oxytype/schemas/configs";

import { migrateConfig } from "./utils";
import { applyConfig } from "./lifecycle";
import { preferencesReadiness } from "../../app/readiness";
import { saveFullConfigToLocalStorage } from "./persistence";
import { SnapshotInitError } from "../utils/snapshot-init-error";
import { getDefaultConfig } from "../constants/default-config";
import { getMutableConfig } from "./store";

export async function updateFromServer(
  accountReady?: Promise<unknown>,
): Promise<void> {
  const lease = captureAccount();
  const remoteConfig = await getRemoteConfig();
  // Fetch remotely in parallel, but local settings must finish applying first.
  await Promise.all([preferencesReadiness().wait(), accountReady]);

  lease.assertCurrent();
  const areConfigsEqual =
    JSON.stringify(getMutableConfig()) === JSON.stringify(remoteConfig);

  if (getMutableConfig() === undefined || !areConfigsEqual) {
    console.log(
      "no local config or local and db configs are different - applying db",
    );
    await applyConfig(remoteConfig);
    saveFullConfigToLocalStorage(true);
  }
}

async function getRemoteConfig(): Promise<ConfigSchemas.Config> {
  const response = await operation("configs.get");

  if (!response.ok) {
    throw new SnapshotInitError(
      `${response.message} (config)`,
      response.status,
    );
  }

  const configData = response.data;
  if (configData !== null && "config" in configData) {
    throw new Error(
      "Config data is not in the correct format. Please refresh the page or contact support.",
    );
  }

  if (configData === undefined || configData === null) {
    return {
      ...getDefaultConfig(),
    };
  } else {
    return migrateConfig(configData);
  }
}
