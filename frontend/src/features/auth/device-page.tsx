import type { SessionState } from "@oxytype/schemas/auth-session";

import { ClientOnly } from "@tanstack/solid-router";
import { createClientOnlyFn } from "@tanstack/solid-start";
import { lazy, Suspense, Show } from "solid-js";

import { AuthPage } from "./page";
const Device = lazy(
  createClientOnlyFn(async () => ({
    default: (await import("./device.client")).DeviceApproval,
  })),
);
export function DevicePage(props: { session: SessionState; code?: string }) {
  return (
    <div class="grid gap-4">
      <h1 class="text-2xl text-main">authorize terminal</h1>
      <Show
        when={props.session.user !== null}
        fallback={
          <>
            <p>
              Sign in to authorize your terminal. Your device code will be kept.
            </p>
            <AuthPage
              session={props.session}
              redirect={`/device${props.code === undefined ? "" : `?user_code=${encodeURIComponent(props.code)}`}`}
            />
          </>
        }
      >
        <ClientOnly>
          <Suspense fallback={<p>Loading device request…</p>}>
            <Device initialCode={props.code} />
          </Suspense>
        </ClientOnly>
      </Show>
    </div>
  );
}
