import { createAppSignal } from "./state";
import { createAppOwned } from "./application";
import { onCleanup } from "solid-js";

const [pendingResultSaves, setPendingResultSaves] = createAppSignal(0);
const [isUpdateReserved, setUpdateReserved] = createAppSignal(false);
export { isUpdateReserved };
const reservation = createAppOwned(() => {
  const state = {
    timer: undefined as ReturnType<typeof setTimeout> | undefined,
  };
  onCleanup(() => clearTimeout(state.timer));
  return state;
});
/** Keep a safe vote valid until the worker's one-second vote collection finishes. */
export function reserveUpdate(): void {
  clearTimeout(reservation().timer);
  setUpdateReserved(true);
  reservation().timer = setTimeout(() => setUpdateReserved(false), 1500);
}

/** In-flight result submissions; updates and reloads wait for them. */
export { pendingResultSaves };

/** Counts `work` as a pending result save until it settles. */
export async function trackResultSave<T>(work: Promise<T>): Promise<T> {
  setPendingResultSaves((count) => count + 1);
  try {
    return await work;
  } finally {
    setPendingResultSaves((count) => count - 1);
  }
}
