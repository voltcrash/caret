import { Config } from "@oxytype/schemas/configs";
import { isAuthenticated } from "../states/core";
import { showErrorNotification } from "../states/notifications";
import { operation } from "../../data/operations";
import { getQueryClient } from "../queries";
import { getRemotePreferencesQueryOptions } from "../queries/preferences";

export async function saveConfig(config: Partial<Config>): Promise<void> {
  if (isAuthenticated()) {
    const response = await operation("configs.save", { body: config });
    if (!response.ok) {
      showErrorNotification("Failed to save config", { operation: response });
    } else {
      getQueryClient().setQueryData(
        getRemotePreferencesQueryOptions().queryKey,
        (previous) => ({ ...previous, ...config }),
      );
    }
  }
}
export async function deleteConfig(): Promise<void> {
  if (isAuthenticated()) {
    const response = await operation("configs.delete");
    if (!response.ok) {
      showErrorNotification("Failed to reset config", { operation: response });
    } else {
      getQueryClient().setQueryData(
        getRemotePreferencesQueryOptions().queryKey,
        null,
      );
    }
  }
}
