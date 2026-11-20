import { OperationError } from "../../data/operation-result";
import { getQueryClient } from "../../data/queries";
import { getRemotePreferencesQueryOptions } from "../../data/queries/preferences";
import { waitForTestIdle } from "../../app/test-idle.client";
import { captureAccount } from "../../app/account-scope";
import * as ConfigSchemas from "@caret/schemas/configs";

import { migrateConfig } from "./utils";
import { applyConfig } from "./lifecycle";
import { preferencesReadiness } from "../../app/readiness";
import { saveFullConfigToLocalStorage } from "./persistence";
import { SnapshotInitError } from "../utils/snapshot-init-error";
import { getDefaultConfig } from "../constants/default-config";
import { peekConfig } from "./store";

export async function updateFromServer(
  accountReady?: Promise<unknown>,
): Promise<void> {
  const lease = captureAccount();
  const remoteConfig = await getRemoteConfig().catch((error: unknown) => {
    lease.assertCurrent();
    throw error;
  });
  // Fetch remotely in parallel, but local settings must finish applying first.
  await Promise.all([preferencesReadiness().wait(), accountReady]);

  await waitForTestIdle(lease.signal);
  lease.assertCurrent();
  const areConfigsEqual =
    JSON.stringify(peekConfig()) === JSON.stringify(remoteConfig);

  if (peekConfig() === undefined || !areConfigsEqual) {
    console.log(
      "no local config or local and db configs are different - applying db",
    );
    await applyConfig(remoteConfig, lease);
    lease.assertCurrent();
    saveFullConfigToLocalStorage(true);
  }
}

async function getRemoteConfig(): Promise<ConfigSchemas.Config> {
  let configData;
  try {
    configData = await getQueryClient().query(
      getRemotePreferencesQueryOptions(),
    );
  } catch (error) {
    if (error instanceof OperationError) {
      throw new SnapshotInitError(`${error.message} (config)`, error.status);
    }
    throw error;
  }
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
