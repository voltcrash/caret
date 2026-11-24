import { untrack } from "solid-js";

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
