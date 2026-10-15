import {
  currentApplication,
  requireApplication,
} from "../../../app/application";
import type { OwnedScope } from "../../../app/scope";
import type { ModuleHotContext } from "../../hooks/createEvent";

/** Reactive; the mounted application's current account-data scope. */
export function collectionScope(): OwnedScope {
  return requireApplication().accountData.scope();
}

type Disposable = { cleanup: () => Promise<void> };

/** Constructs on first use within the mounted application's account scope. */
export function defineCollection<T extends Disposable>(
  hot: ModuleHotContext | undefined,
  create: () => T,
): () => T {
  const key = {};
  hot?.dispose(() => {
    currentApplication()?.accountData.scope().release(key);
  });
  return () =>
    collectionScope().use(key, create, (collection) => {
      void collection.cleanup();
    });
}
