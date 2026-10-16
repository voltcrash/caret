import { createAppSignal } from "./state";

const [pendingResultSaves, setPendingResultSaves] = createAppSignal(0);

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
