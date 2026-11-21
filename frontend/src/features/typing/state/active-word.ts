import { createAppSignalWithSetters } from "#shared/hooks/createSignalWithSetters.ts";

export const [
  getActiveWordIndex,
  {
    increase: increaseActiveWordIndex,
    decrease: decreaseActiveWordIndex,
    reset: resetActiveWordIndex,
    fromEngine: setActiveWordIndex,
  },
] = createAppSignalWithSetters<number>(0)({
  increase: (set) => set((n) => n + 1),
  decrease: (set) => set((n) => n - 1),
  reset: (set) => set(0),
  fromEngine: (set, index: number) => set(index),
});
