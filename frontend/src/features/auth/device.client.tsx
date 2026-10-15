import { createSignal, JSXElement, onCleanup, Show } from "solid-js";

import { decideDeviceCode, reviewDeviceCode } from "../../ts/ape/device-auth";
import { Button } from "../../ts/components/common/Button";
import { H3 } from "../../ts/components/common/Headers";
import { LoadingCircle } from "../../ts/components/common/LoadingCircle";
import { createEffectOn } from "../../ts/hooks/effects";
import { createErrorMessage } from "../../ts/utils/error";
import { getAuthenticatedUser } from "./state.client";

export function DeviceApproval(props: { initialCode?: string }): JSXElement {
  const [code, setCode] = createSignal("");
  const [reviewedCode, setReviewedCode] = createSignal<string>();
  const [status, setStatus] = createSignal("pending");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();
  let revision = 0;
  createEffectOn(
    [() => props.initialCode, () => getAuthenticatedUser()?.uid],
    ([initialCode]) => {
      revision++;
      setCode(initialCode ?? "");
      setReviewedCode(undefined);
      setStatus("pending");
      setError(undefined);
      setBusy(false);
    },
  );
  onCleanup(() => revision++);

  const submit = async (decision?: "approve" | "deny"): Promise<void> => {
    if (busy() || getAuthenticatedUser() === null) return;
    const userCode = (reviewedCode() ?? code()).trim().toUpperCase();
    if (userCode === "") return;
    const current = ++revision;
    setBusy(true);
    setError(undefined);
    try {
      if (decision === undefined) {
        const request = await reviewDeviceCode(userCode);
        if (current !== revision) return;
        if (!["pending", "approved", "denied"].includes(request.status)) {
          throw new Error("Unknown device request status");
        }
        setReviewedCode(userCode);
        setStatus(request.status);
      } else {
        await decideDeviceCode(userCode, decision);
        if (current !== revision) return;
        setStatus(decision === "approve" ? "approved" : "denied");
      }
    } catch (err) {
      if (current === revision) {
        setError(createErrorMessage(err, "Could not process device request"));
      }
    } finally {
      if (current === revision) setBusy(false);
    }
  };

  return (
    <div class="grid w-full max-w-md gap-4">
      <H3 text="authorize terminal" fa={{ icon: "fa-terminal" }} class="p-0" />
      <Show
        when={status() === "pending"}
        fallback={
          <p role="status">
            {status() === "approved"
              ? "Terminal authorized. Return to your terminal to finish signing in."
              : "Request denied. Your terminal was not signed in."}
          </p>
        }
      >
        <Show
          when={reviewedCode()}
          fallback={
            <form
              class="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <label class="grid gap-2 text-sub">
                code from your terminal
                <input
                  class="rounded bg-sub-alt p-3 text-text outline-none focus-visible:ring-2 focus-visible:ring-main"
                  value={code()}
                  onInput={(event) => setCode(event.currentTarget.value)}
                  required
                  maxLength={32}
                  autocomplete="off"
                  autoCapitalize="characters"
                  spellcheck={false}
                  disabled={busy()}
                />
              </label>
              <Button
                type="submit"
                text="continue"
                disabled={busy() || code().trim() === ""}
              />
            </form>
          }
        >
          <p>
            Oxytype terminal client wants to sign in as{" "}
            <strong>{getAuthenticatedUser()?.displayName}</strong> and access
            your account.
          </p>
          <p class="rounded bg-sub-alt p-4 text-center text-2xl tracking-widest">
            {reviewedCode()}
          </p>
          <p class="text-sub">
            Confirm this code matches your own terminal. Approve only a request
            you started.
          </p>
          <div class="grid grid-cols-2 gap-4">
            <Button
              text="deny"
              onClick={() => void submit("deny")}
              disabled={busy()}
            />
            <Button
              text="approve"
              fa={{ icon: "fa-check" }}
              onClick={() => void submit("approve")}
              disabled={busy()}
            />
          </div>
          <Button
            variant="text"
            text="use another code"
            disabled={busy()}
            onClick={() => {
              setReviewedCode(undefined);
              setError(undefined);
            }}
          />
        </Show>
      </Show>
      <Show when={busy()}>
        <div role="status" aria-label="processing request">
          <LoadingCircle />
        </div>
      </Show>
      <Show when={error()}>
        <p role="alert" class="text-error">
          {error()}
        </p>
      </Show>
    </div>
  );
}
