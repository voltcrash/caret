import { createSignal, onCleanup } from "solid-js";
import { expect, it, vi } from "vite-plus/test";
import { createModuleEffectOn } from "../../src/ts/hooks/effects";

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
