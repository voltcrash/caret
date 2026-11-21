import { createAppSignal } from "#app/state.ts";

export const [isRepeated, setIsRepeated] = createAppSignal(false);

export const [isPaceRepeat, setIsPaceRepeat] = createAppSignal(false);

export const [getPaceCaretWpm, setPaceCaretWpm] = createAppSignal<
  number | undefined
>(undefined);
