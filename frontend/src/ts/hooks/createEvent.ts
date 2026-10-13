import { onCleanup } from "solid-js";

export type ModuleHotContext = { dispose: (callback: () => void) => void };

type Listener<T> = (value: T) => void;
type EventArgs<T> = [T] extends [undefined] ? [] : [value: T];

type EventBus<T> = {
  dispatch: (...args: EventArgs<T>) => void;
  subscribe: (fn: Listener<T>, hot?: ModuleHotContext) => () => void;
  useListener: (fn: Listener<T>) => void;
};

/**
 * Creates a pub-sub event bus.
 *
 * - `dispatch(value)` notifies all listeners. No args needed when `T` is `undefined`.
 * - `subscribe(fn)` registers a listener, returns an unsubscribe function.
 * - `useListener(fn)` registers a listener that auto-unsubscribes via Solid's `onCleanup`.
 *
 * @example
 * ```ts
 * const clickEvent = createEvent<{ x: number; y: number }>();
 * clickEvent.useListener(({ x, y }) => console.log(x, y));
 * clickEvent.dispatch({ x: 10, y: 20 });
 *
 * const resetEvent = createEvent();
 * resetEvent.useListener(() => console.log("reset"));
 * resetEvent.dispatch();
 * ```
 */

export function createEvent<T = undefined>(): EventBus<T> {
  const listeners = new Set<Listener<T>>();

  function dispatch(...args: EventArgs<T>): void {
    const value = args[0] as T;
    for (const fn of listeners) {
      try {
        fn(value);
      } catch (e) {
        console.error(e);
      }
    }
  }

  function subscribe(fn: Listener<T>, hot?: ModuleHotContext): () => void {
    listeners.add(fn);
    const unsubscribe = (): void => {
      listeners.delete(fn);
    };
    hot?.dispose(unsubscribe);
    return unsubscribe;
  }

  // Auto-unsubscribes when the Solid owner scope is disposed
  function useListener(fn: Listener<T>): void {
    listeners.add(fn);
    onCleanup(() => listeners.delete(fn));
  }

  return { dispatch, subscribe, useListener };
}
