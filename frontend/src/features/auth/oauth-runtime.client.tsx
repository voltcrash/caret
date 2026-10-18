import { onCleanup, onMount } from "solid-js";

import { getAuthClient } from "./client.client";
import { oauthRequestEvent } from "./popup.client";
import { checkAuthResult } from "./result";

/** Own popup windows and listeners for sign-in, linking, and reauthentication. */
export function OAuthRuntime(): null {
  onMount(() => {
    const pending = new Set<() => void>();
    const unsubscribe = oauthRequestEvent.subscribe((request) => {
      const popup = window.open(
        "about:blank",
        "oxytype-auth",
        "popup,width=600,height=750",
      );
      if (!popup) {
        request.reject(
          new Error("Sign-in popup blocked. Allow popups and retry."),
        );
        return;
      }
      const requestId = crypto.randomUUID();
      const callbackURL = `${window.location.origin}/oauth-callback.html?requestId=${requestId}`;
      let done = false;
      const finish = (error?: Error): void => {
        if (done) return;
        done = true;
        clearInterval(timer);
        window.removeEventListener("message", message);
        pending.delete(cancel);
        popup.close();
        if (error) request.reject(error);
        else request.resolve();
      };
      const cancel = (): void => finish(new Error("Sign-in cancelled"));
      const message = (
        event: MessageEvent<{
          requestId?: string;
          type?: string;
          error?: string | null;
        }>,
      ): void => {
        if (
          event.origin !== window.location.origin ||
          event.source !== popup ||
          event.data?.requestId !== requestId ||
          event.data?.type !== "oxytype-auth"
        ) {
          return;
        }
        finish(
          event.data.error !== null && event.data.error !== undefined
            ? new Error(event.data.error)
            : undefined,
        );
      };
      const timer = setInterval(() => {
        if (popup.closed) cancel();
      }, 500);
      window.addEventListener("message", message);
      pending.add(cancel);
      void (async () => {
        try {
          const result = request.link
            ? await getAuthClient().linkSocial({
                provider: request.provider,
                callbackURL,
                errorCallbackURL: callbackURL,
                disableRedirect: true,
              })
            : await getAuthClient().signIn.social({
                provider: request.provider,
                callbackURL,
                errorCallbackURL: callbackURL,
                disableRedirect: true,
                additionalData: { rememberMe: request.rememberMe },
                additionalParams: { prompt: "select_account" },
              });
          const data = checkAuthResult(result);
          if (data?.url === undefined || data.url === "") {
            throw new Error("Provider did not return a sign-in URL");
          }
          if (!done) popup.location.href = data.url;
        } catch (error) {
          finish(error instanceof Error ? error : new Error("Sign-in failed"));
        }
      })();
    });
    onCleanup(() => {
      unsubscribe();
      for (const cancel of pending) cancel();
    });
  });
  return null;
}
