import { createAppSignal } from "#app/state.ts";

// Set when the user bails out of a test early; reset by TestLogic.restart().
export const [getBailedOut, setBailedOut] = createAppSignal(false);

export const [isTestInvalid, setIsTestInvalid] = createAppSignal(false);
