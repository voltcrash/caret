import { createAppSignal } from "../../app/state";

// "instant" hides without the fade (layoutfluid on test restart).
export type FunboxTimerVisibility = "shown" | "hidden" | "instant";

export const [getMemoryTimerText, setMemoryTimerText] = createAppSignal("");
export const [getMemoryTimerVisibility, setMemoryTimerVisibility] =
  createAppSignal<FunboxTimerVisibility>("hidden");

export const [getLayoutfluidTimerText, setLayoutfluidTimerText] =
  createAppSignal("");
export const [getLayoutfluidTimerVisibility, setLayoutfluidTimerVisibility] =
  createAppSignal<FunboxTimerVisibility>("hidden");
