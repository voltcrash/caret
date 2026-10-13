import { createSignal, onCleanup } from "solid-js";
import { expect, it, vi } from "vite-plus/test";
import {
  createModuleEffectOn,
  createModuleRoot,
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
  createModuleRoot(undefined, () =>
    createEffectOn([number, text] as const, fn),
  );
  expect(fn).toHaveBeenLastCalledWith([1, "a"], undefined, undefined);
  setUntracked(1);
  expect(fn).toHaveBeenCalledOnce();
  setNumber(2);
  expect(fn).toHaveBeenLastCalledWith([2, "a"], [1, "a"], 1);
  setText("b");
  expect(fn).toHaveBeenLastCalledWith([2, "b"], [2, "a"], 3);
});

it("defers debounced effects and cancels pending callbacks on disposal", () => {
  vi.useFakeTimers();
  const [value, setValue] = createSignal(1);
  const dispose = vi.fn<(cleanup: () => void) => void>();
  const fn = vi.fn();
  createModuleRoot({ dispose }, () =>
    createDebouncedEffectOn(50, value, fn, { defer: true }),
  );
  vi.advanceTimersByTime(50);
  expect(fn).not.toHaveBeenCalled();
  setValue(2);
  setValue(3);
  vi.advanceTimersByTime(50);
  expect(fn).toHaveBeenLastCalledWith(3, 2, undefined);
  setValue(4);
  dispose.mock.calls[0]?.[0]();
  vi.advanceTimersByTime(50);
  expect(fn).toHaveBeenCalledOnce();
  vi.useRealTimers();
});

it("disposes module effects and their resources during hot replacement", () => {
  const [value, setValue] = createSignal(0);
  const dispose = vi.fn<(callback: () => void) => void>();
  const effect = vi.fn();
  const cleanup = vi.fn();
  createModuleEffectOn({ dispose }, value, (current) => {
    effect(current);
    onCleanup(cleanup);
  });
  expect(effect).toHaveBeenLastCalledWith(0);
  setValue(1);
  expect(effect).toHaveBeenLastCalledWith(1);
  expect(cleanup).toHaveBeenCalledOnce();
  dispose.mock.calls[0]?.[0]();
  setValue(2);
  expect(effect).toHaveBeenCalledTimes(2);
  expect(cleanup).toHaveBeenCalledTimes(2);
});
