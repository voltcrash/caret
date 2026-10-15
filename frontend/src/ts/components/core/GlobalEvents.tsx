import { onCleanup, onMount } from "solid-js";

import { getMutableConfig } from "../../config/store";
import { ModifierKeys } from "../../constants/modifier-keys";
import { updateCurrentCode } from "../../controllers/sound-controller";
import { connectionEvent } from "../../events/connection";
import { isInputElementFocused } from "../../input/input-element";
import { getActivePage } from "../../states/core";
import { showErrorNotification } from "../../states/notifications";
import { isAnyPopupVisible } from "../../states/overlay-visibility";
import * as PageTransition from "../../states/page-transition";
import { getFocus, getResultVisible } from "../../states/test";
import * as Focus from "../../test/focus";
import { focusWords } from "../../test/test-ui";
import { isDevEnvironment } from "../../utils/env";

export function GlobalEvents(): null {
  onMount(() => {
    const autofocus = (e: KeyboardEvent): void => {
      updateCurrentCode(e);
      if (PageTransition.get() || e.key === undefined) return;
      if (
        isDevEnvironment() &&
        (document.activeElement as HTMLElement | null)?.dataset["uiElement"] ===
          "signalDevtoolsInput"
      ) {
        return;
      }

      if (
        getActivePage() === "test" &&
        !getResultVisible() &&
        !isInputElementFocused()
      ) {
        // Keep the expensive popup check outside the focused keystroke path.
        if (
          !isAnyPopupVisible() &&
          !["Enter", " ", "Escape", "Tab", ...ModifierKeys].includes(e.key) &&
          !e.metaKey &&
          !e.ctrlKey
        ) {
          focusWords();
          if (getMutableConfig().showOutOfFocusWarning) e.preventDefault();
        }
      }
    };

    const preventSpaceScroll = (e: KeyboardEvent): void => {
      if (
        e.code === "Space" &&
        (e.target === document.body ||
          (e.target as HTMLElement)?.id === "result")
      ) {
        e.preventDefault();
      }
    };

    const mousemove = (event: MouseEvent): void => {
      if (PageTransition.get() || !getFocus()) return;
      // Ignore small desk/mouse vibrations, preserving the >3px guard.
      if (event.movementX > 3 || event.movementY > 3) Focus.set(false);
    };

    const previousError = window.onerror;
    const previousRejection = window.onunhandledrejection;
    const onError: OnErrorEventHandlerNonNull = (
      message,
      url,
      line,
      column,
      error,
    ): void => {
      if (isDevEnvironment()) {
        showErrorNotification(error?.message ?? "Undefined message", {
          customTitle: "DEV: Unhandled error",
          durationMs: 5000,
          important: true,
        });
        console.error({ message, url, line, column, error });
      }
    };
    const onRejection = (e: PromiseRejectionEvent): void => {
      if (isDevEnvironment()) {
        showErrorNotification(
          (e.reason as Error).message ?? e.reason ?? "Undefined message",
          {
            customTitle: "DEV: Unhandled rejection",
            durationMs: 5000,
            important: true,
          },
        );
      }
    };

    document.addEventListener("keydown", autofocus);
    const online = (): void => connectionEvent.dispatch(true);
    const offline = (): void => connectionEvent.dispatch(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    document.addEventListener("mousemove", mousemove);
    window.addEventListener("keydown", preventSpaceScroll);
    window.onerror = onError;
    window.onunhandledrejection = onRejection;
    onCleanup(() => {
      document.removeEventListener("keydown", autofocus);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      document.removeEventListener("mousemove", mousemove);
      window.removeEventListener("keydown", preventSpaceScroll);
      if (window.onerror === onError) window.onerror = previousError;
      if (window.onunhandledrejection === onRejection) {
        window.onunhandledrejection = previousRejection;
      }
    });
  });
  return null;
}
