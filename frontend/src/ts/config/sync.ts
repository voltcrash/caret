import { Config } from "@caret/schemas/configs";
import { isAuthenticated } from "../states/core";
import { showErrorNotification } from "../states/notifications";
import { operation } from "../../data/operations";
import { getQueryClient } from "../queries";
import { getRemotePreferencesQueryOptions } from "../queries/preferences";
import { captureAccount, createAccountOwned } from "../../app/account-scope";
import { onCleanup } from "solid-js";
import { OperationError } from "../../data/operation-result";

const synchronization = createAccountOwned(() => {
  const state = { pending: {} as Partial<Config>, queue: Promise.resolve() };
  const retry = (): void => {
    if (Object.keys(state.pending).length > 0) void saveConfig({}).catch(() => undefined);
  };
  window.addEventListener("online", retry);
  onCleanup(() => window.removeEventListener("online", retry));
  return state;
});

async function serialize(work: () => Promise<void>): Promise<void> {
  const state = synchronization();
  const lease = captureAccount();
  const next = state.queue.then(async () => {
    lease.assertCurrent();
    return await work();
  });
  state.queue = next.catch(() => undefined);
  await next;
}

export async function saveConfig(config: Partial<Config>): Promise<void> {
  if (isAuthenticated()) {
    const state = synchronization();
    Object.assign(state.pending, structuredClone(config));
    await serialize(async () => {
    const lease = captureAccount();
    const pending = state.pending;
    state.pending = {};
    if (Object.keys(pending).length === 0) return;
    const response = await operation("configs.save", { body: pending });
    lease.assertCurrent();
    if (!response.ok) {
      state.pending = { ...pending, ...state.pending };
      showErrorNotification("Failed to save config", { operation: response });
      throw new OperationError(response);
    } else {
      getQueryClient().setQueryData(
        getRemotePreferencesQueryOptions().queryKey,
        (previous) => ({ ...previous, ...pending }),
      );
    }
    });
  }
}
export async function deleteConfig(): Promise<void> {
  if (isAuthenticated()) {
    synchronization().pending = {};
    await serialize(async () => {
    const lease = captureAccount();
    const response = await operation("configs.delete");
    lease.assertCurrent();
    if (!response.ok) {
      showErrorNotification("Failed to reset config", { operation: response });
    } else {
      getQueryClient().setQueryData(
        getRemotePreferencesQueryOptions().queryKey,
        null,
      );
    }
    });
  }
}
