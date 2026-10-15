import { createSignal, JSXElement, onMount } from "solid-js";

import { Fa } from "../../ts/components/common/Fa";
import { StandaloneHeader } from "../../ts/components/standalone/StandaloneHeader";

export function OAuthCallback(): JSXElement {
  const [error, setError] = createSignal<string | null>(null);

  onMount(() => {
    const params = new URL(window.location.href).searchParams;
    const requestId = params.get("requestId");
    if (requestId === null || requestId === "") {
      setError("Sign-in request not found");
      return;
    }
    const callbackError = params.get("error");
    setError(callbackError);
    (window.opener as Window | null)?.postMessage(
      { type: "oxytype-auth", requestId, error: callbackError },
      window.location.origin,
    );
    window.close();
  });

  return (
    <>
      <StandaloneHeader label="Sign in" />
      <main class="grid justify-center text-text">
        <div class="grid w-full max-w-[350px] content-center items-center gap-4 text-center">
          <div class="text-[2rem] text-main">
            <Fa icon={error() === null ? "fa-check" : "fa-times"} fixedWidth />
          </div>
          <div>{error() ?? "You can close this tab"}</div>
        </div>
      </main>
    </>
  );
}
