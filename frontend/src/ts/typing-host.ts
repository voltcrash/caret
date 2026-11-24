import { untrack } from "solid-js";

import { currentApplication } from "../app/application";
import { createAppSignal } from "../app/state";

/**
 * Typing actions shared code triggers. The typing route binds them while it
 * is mounted; unbound, they do nothing and the route reads as inactive.
 */
type TypingHost = {
  isRouteActive: () => boolean;
  restart: (options?: { isQuickRestart?: boolean }) => void;
  blur: () => void;
  reloadPaceCaret: () => Promise<void>;
  updateHints: () => void;
  isNoQuitActive: () => boolean;
  isInputFocused: () => boolean;
};

// Reactive so derived state (hotkeys, palette behavior) follows mounts.
const [getHost, setHost] = createAppSignal<TypingHost>();

/** Publishes `host`; the returned release clears it if still current. */
export function bindTypingHost(host: TypingHost): () => void {
  setHost(() => host);
  return () => {
    if (untrack(getHost) === host) setHost(undefined);
  };
}

export function isTypingRouteActive(): boolean {
  return getHost()?.isRouteActive() ?? false;
}

export function restartTest(options?: { isQuickRestart?: boolean }): void {
  untrack(getHost)?.restart(options);
}

export function blurTest(): void {
  untrack(getHost)?.blur();
}

export async function reloadPaceCaret(): Promise<void> {
  await untrack(getHost)?.reloadPaceCaret();
}

export function updateTestHints(): void {
  untrack(getHost)?.updateHints();
}

/** Whether the running test forbids quitting; false off the typing route. */
export function isNoQuitActive(): boolean {
  return untrack(getHost)?.isNoQuitActive() ?? false;
}

/** Whether the typing input element has focus; false off the typing route. */
export function isTypingInputFocused(): boolean {
  return untrack(getHost)?.isInputFocused() ?? false;
}

type TestLifecycleSelectors = {
  isTestActive: () => boolean;
  isTestRestarting: () => boolean;
  isResultCalculating: () => boolean;
  isResultLoading: () => boolean;
  getResultVisible: () => boolean;
  getTestInitError: () => { message: string | undefined } | null;
};

const [getLifecycleSelectors, setLifecycleSelectors] =
  createAppSignal<TestLifecycleSelectors>();

/** Publishes typing lifecycle selectors; the returned release clears them if still current. */
export function bindTestLifecycle(
  selectors: TestLifecycleSelectors,
): () => void {
  setLifecycleSelectors(() => selectors);
  return () => {
    if (currentApplication() === undefined) return;
    if (untrack(getLifecycleSelectors) === selectors) {
      setLifecycleSelectors(undefined);
    }
  };
}

export const isTestActive = (): boolean =>
  getLifecycleSelectors()?.isTestActive() ?? false;
export const isTestRestarting = (): boolean =>
  getLifecycleSelectors()?.isTestRestarting() ?? false;
export const isResultCalculating = (): boolean =>
  getLifecycleSelectors()?.isResultCalculating() ?? false;
export const isResultLoading = (): boolean =>
  getLifecycleSelectors()?.isResultLoading() ?? false;
export const getResultVisible = (): boolean =>
  getLifecycleSelectors()?.getResultVisible() ?? false;
export const getTestInitError = (): { message: string | undefined } | null =>
  getLifecycleSelectors()?.getTestInitError() ?? null;
