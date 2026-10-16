import { onCleanup, onMount } from "solid-js";

import { connectionEvent } from "../../events/connection";
import { showErrorNotification } from "../../states/notifications";
import { isDevEnvironment } from "../../utils/env";

/** Host-neutral document listeners: connection, space scrolling, dev errors. */
export function GlobalEvents(): null {
  onMount(() => {
    const preventSpaceScroll = (e: KeyboardEvent): void => {
      if (
        e.code === "Space" &&
        (e.target === document.body ||
          (e.target as HTMLElement)?.id === "result")
      ) {
        e.preventDefault();
      }
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

    const online = (): void => connectionEvent.dispatch(true);
    const offline = (): void => connectionEvent.dispatch(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    window.addEventListener("keydown", preventSpaceScroll);
    window.onerror = onError;
    window.onunhandledrejection = onRejection;
    onCleanup(() => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      window.removeEventListener("keydown", preventSpaceScroll);
      if (window.onerror === onError) window.onerror = previousError;
      if (window.onunhandledrejection === onRejection) {
        window.onunhandledrejection = previousRejection;
      }
    });
  });
  return null;
}
