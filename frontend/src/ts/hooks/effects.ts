import { createEffect, on, onCleanup } from "solid-js";
import { debounce } from "@oxytype/util/timing";
import type { AccessorArray } from "solid-js";

type Accessor<T = unknown> = () => T;

type OnValue<T> = T extends readonly Accessor[]
  ? { [K in keyof T]: T[K] extends Accessor<infer V> ? V : never }
  : T extends Accessor
    ? ReturnType<T>
    : never;

function onDependencies<T extends Accessor | readonly Accessor[]>(
  deps: T,
): Accessor<OnValue<T>> | AccessorArray<OnValue<T>> {
  // Solid reads accessor arrays without mutating them; preserve readonly tuple inference.
  return deps as Accessor<OnValue<T>> | AccessorArray<OnValue<T>>;
}

export function createEffectOn<
  T extends Accessor | readonly Accessor[],
  U = void,
>(
  deps: T,
  fn: (value: OnValue<T>, prev: OnValue<T> | undefined, prevValue?: U) => U,
  options: { defer?: boolean } = {},
): void {
  createEffect<U | undefined>(on(onDependencies(deps), fn, options));
}

export function createDebouncedEffectOn<
  T extends Accessor | readonly Accessor[],
  U = void,
>(
  delay: number,
  deps: T,
  fn: (value: OnValue<T>, prev: OnValue<T> | undefined, prevValue?: U) => U,
  options: { defer?: boolean } = {},
): void {
  const debouncedFn = debounce(delay, fn);
  onCleanup(() => debouncedFn.cancel());
  createEffect(
    on<OnValue<T>, undefined, U | undefined>(
      onDependencies(deps),
      (value, previous, result) => {
        debouncedFn(value, previous, result);
        return undefined;
      },
      options,
    ),
  );
}
