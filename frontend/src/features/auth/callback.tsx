import { createSignal, JSXElement, onMount } from "solid-js";

import { Fa } from "../../ts/components/common/Fa";
import { StandaloneHeader } from "../../ts/components/standalone/StandaloneHeader";

/** Show provider/Better Auth error codes only; never free text from a crafted link. */
function displayedError(error: string | null): string | null {
  if (error === null) return null;
  return /^[a-z0-9_']{1,64}$/i.test(error) ? error : "Sign-in failed";
}

export function OAuthCallback(): JSXElement {
  const [error, setError] = createSignal<string | null>(null);

  onMount(() => {
    const params = new URL(window.location.href).searchParams;
    const requestId = params.get("requestId");
    const callbackError = params.get("error");
    if (requestId === null || requestId === "") {
      // Errors Better Auth cannot tie to a request arrive without a request ID.
      setError(displayedError(callbackError) ?? "Sign-in request not found");
      return;
    }
    setError(displayedError(callbackError));
    (window.opener as Window | null)?.postMessage(
      { type: "caret-auth", requestId, error: callbackError },
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
