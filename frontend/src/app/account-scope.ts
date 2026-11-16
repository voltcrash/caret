import { createRoot } from "solid-js";
import { requireApplication } from "./application";
import type { AccountLease } from "./account-data";

/** Account state and its reactive computations end on every identity transition. */
export function createAccountOwned<T>(create: () => T): () => T {
  const key = {};
  return () => {
    const app = requireApplication();
    const scope = app.accountData.scope();
    const existing = scope.peek(key) as { value: { value: T } } | undefined;
    if (existing !== undefined) return existing.value.value;
    return scope.use(
      key,
      () => createRoot((dispose) => ({ value: create(), dispose }), app.owner),
      (entry) => entry.dispose(),
    ).value;
  };
}

export function captureAccount(): AccountLease {
  return requireApplication().accountData.capture();
}
