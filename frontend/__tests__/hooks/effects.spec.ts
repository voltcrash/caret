import { createRoot, createSignal, onCleanup } from "solid-js";
import { expect, it, vi } from "vite-plus/test";
import {
  createEffectOn,
  createDebouncedEffectOn,
} from "../../src/ts/hooks/effects";

it("tracks dependency tuples and previous callback results while leaving callback reads untracked", () => {
  const [number, setNumber] = createSignal(1);
  const [text, setText] = createSignal("a");
  const [untracked, setUntracked] = createSignal(0);
  const fn = vi.fn(
    (
      value: readonly [number, string],
      _previous: readonly [number, string] | undefined,
      result?: number,
    ) => {
      untracked();
      return (result ?? 0) + value[0];
    },
  );
  const dispose = createRoot((dispose) => {
    createEffectOn([number, text] as const, fn);
    return dispose;
  });
  expect(fn).toHaveBeenLastCalledWith([1, "a"], undefined, undefined);
  setUntracked(1);
  expect(fn).toHaveBeenCalledOnce();
  setNumber(2);
  expect(fn).toHaveBeenLastCalledWith([2, "a"], [1, "a"], 1);
  setText("b");
  expect(fn).toHaveBeenLastCalledWith([2, "b"], [2, "a"], 3);
  dispose();
});

it("defers debounced effects and cancels pending callbacks on disposal", () => {
  vi.useFakeTimers();
  const [value, setValue] = createSignal(1);
  const fn = vi.fn();
  const dispose = createRoot((dispose) => {
    createDebouncedEffectOn(50, value, fn, { defer: true });
    return dispose;
  });
  vi.advanceTimersByTime(50);
  expect(fn).not.toHaveBeenCalled();
  setValue(2);
  setValue(3);
  vi.advanceTimersByTime(50);
  expect(fn).toHaveBeenLastCalledWith(3, 2, undefined);
  setValue(4);
  dispose();
  vi.advanceTimersByTime(50);
  expect(fn).toHaveBeenCalledOnce();
  vi.useRealTimers();
});

it("disposes effects and their resources with their owner", () => {
  const [value, setValue] = createSignal(0);
  const effect = vi.fn();
  const cleanup = vi.fn();
  const dispose = createRoot((dispose) => {
    createEffectOn(value, (current) => {
      effect(current);
      onCleanup(cleanup);
    });
    return dispose;
  });
  expect(effect).toHaveBeenLastCalledWith(0);
  setValue(1);
  expect(effect).toHaveBeenLastCalledWith(1);
  expect(cleanup).toHaveBeenCalledOnce();
  dispose();
  setValue(2);
  expect(effect).toHaveBeenCalledTimes(2);
  expect(cleanup).toHaveBeenCalledTimes(2);
});
