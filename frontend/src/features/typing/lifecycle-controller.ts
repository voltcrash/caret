import { createSignal, onCleanup, type Accessor } from "solid-js";
import { createAppOwned } from "../../app/application";
import {
  initialLifecycle,
  isCompleting,
  isPreparing,
  resultLoading,
  resultVisible,
  matchesToken,
  transitionLifecycle,
  type LifecycleEvent,
  type LifecycleToken,
  type LifecycleState,
} from "./lifecycle-machine";

export type LifecycleOperation = {
  token: LifecycleToken;
  signal: AbortSignal;
  isCurrent: () => boolean;
  assertCurrent: () => void;
  send: (type: Exclude<LifecycleEvent["type"], "FAIL" | "FATAL">) => boolean;
  wait: <T>(task: Promise<T>, timeoutMs?: number) => Promise<T>;
};

type LifecycleController = {
  state: Accessor<LifecycleState>;
  send: (event: LifecycleEvent) => boolean;
  capture: () => LifecycleOperation;
  recoverWith: (retry: () => Promise<void>) => void;
  retry: () => Promise<void>;
};

export function createLifecycleController(): LifecycleController {
  const [state, setState] = createSignal(initialLifecycle());
  let abort = new AbortController();
  let recovery: (() => Promise<void>) | undefined;
  const send = (event: LifecycleEvent): boolean => {
    const previous = state();
    const next = transitionLifecycle(previous, event);
    if (next === previous) return false;
    if (!matchesToken(previous, next)) {
      abort.abort(new DOMException("Typing operation cancelled", "AbortError"));
      abort = new AbortController();
      if (event.type !== "FAIL" && event.type !== "RETRY") recovery = undefined;
    }
    setState(next);
    return true;
  };
  const capture = (): LifecycleOperation => {
    const token = state();
    const signal = abort.signal;
    const isCurrent = (): boolean =>
      !signal.aborted && matchesToken(token, state());
    const assertCurrent = (): void => {
      if (!isCurrent()) {
        throw new DOMException("Typing operation cancelled", "AbortError");
      }
    };
    return {
      token,
      signal,
      isCurrent,
      assertCurrent,
      send: (type) => send({ type, token }),
      wait: async <T>(task: Promise<T>, timeoutMs = 30_000): Promise<T> => {
        assertCurrent();
        let timer: ReturnType<typeof setTimeout> | undefined;
        let cancel: () => void = () => undefined;
        try {
          const value = await Promise.race([
            task,
            new Promise<never>((_resolve, reject) => {
              cancel = () => reject(signal.reason);
              signal.addEventListener("abort", cancel, { once: true });
              timer = setTimeout(
                () =>
                  reject(
                    new Error("Typing operation timed out. Please retry."),
                  ),
                timeoutMs,
              );
            }),
          ]);
          assertCurrent();
          return value;
        } finally {
          clearTimeout(timer);
          signal.removeEventListener("abort", cancel);
        }
      },
    };
  };
  return {
    state,
    send,
    capture,
    recoverWith: (retry: () => Promise<void>): void => {
      recovery = retry;
    },
    retry: async (): Promise<void> => {
      const retry = recovery;
      if (retry === undefined || !send({ type: "RETRY" })) return;
      await retry();
    },
  };
}

export const getTypingLifecycle = createAppOwned(() => {
  const controller = createLifecycleController();
  onCleanup(() => controller.send({ type: "DISPOSE" }));
  return controller;
});

export const isTestActive = (): boolean =>
  getTypingLifecycle().state().phase === "running";
export const isTestRestarting = (): boolean =>
  isPreparing(getTypingLifecycle().state());
export const isResultCalculating = (): boolean =>
  isCompleting(getTypingLifecycle().state());
export const isResultLoading = (): boolean =>
  resultLoading(getTypingLifecycle().state());
export const getResultVisible = (): boolean =>
  resultVisible(getTypingLifecycle().state());
export function getTestInitError(): { message: string | undefined } | null {
  const state = getTypingLifecycle().state();
  return "error" in state
    ? {
        message: state.error instanceof Error ? state.error.message : undefined,
      }
    : null;
}
export const lifecycleSelectors = {
  isTestActive,
  isTestRestarting,
  isResultCalculating,
  isResultLoading,
  getResultVisible,
  getTestInitError,
};
