import { Config } from "@oxytype/schemas/configs";
import { isAuthenticated } from "../states/core";
import { showErrorNotification } from "../states/notifications";
import { operation } from "../../data/operations";

export async function saveConfig(config: Partial<Config>): Promise<void> {
  if (isAuthenticated()) {
    const response = await operation("configs.save", { body: config });
    if (!response.ok) {
      showErrorNotification("Failed to save config", { operation: response });
    }
  }
}
export async function deleteConfig(): Promise<void> {
  if (isAuthenticated()) {
    const response = await operation("configs.delete");
    if (!response.ok) {
      showErrorNotification("Failed to reset config", { operation: response });
    }
  }
}
