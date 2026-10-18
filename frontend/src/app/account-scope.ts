import { createRoot } from "solid-js";
import { requireApplication } from "./application";
import type { AccountLease } from "./account-data";

/** Account state and its reactive computations end on every identity transition. */
export function createAccountOwned<T>(create: () => T): () => T {
  const key = {};
  return () => {
    const app = requireApplication();
    return app.accountData.scope().use(
      key,
      () => createRoot((dispose) => ({ value: create(), dispose }), app.owner),
      (entry) => entry.dispose(),
    ).value;
  };
}

export function captureAccount(): AccountLease {
  return requireApplication().accountData.capture();
}
