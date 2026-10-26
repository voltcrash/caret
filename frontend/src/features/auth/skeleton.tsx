import type { SessionState } from "@caret/schemas/auth-session";

import { For, type JSXElement, Show } from "solid-js";
import { envConfig } from "virtual:env-config";

import { Skeleton } from "../../components/skeleton";

/**
 * The sign-in panel's copy and provider buttons while its browser code
 * loads, so the buttons appear where their placeholders were.
 */
export function AuthPanelSkeleton(props: {
  session: SessionState;
}): JSXElement {
  const providers = envConfig.authProviders.filter(
    (provider) => provider === "google" || provider === "github",
  );
  const signUp = (): boolean =>
    props.session.user === null && props.session.signUpEnabled;
  const text = (): string => {
    const user = props.session.user;
    if (user !== null) return `Signed in as ${user.displayName}`;
    return props.session.signUpEnabled
      ? "New here? Signing in creates an account."
      : "Login/Signup is disabled or the server is down/under maintenance.";
  };
  return (
    <section
      role="status"
      aria-label="Loading sign in"
      aria-busy="true"
      class="grid gap-4"
    >
      <p class="text-sub">{text()}</p>
      <Show when={signUp()}>
        <Skeleton class="grid gap-2">
          <For each={providers}>
            {/* p-3 buttons: 1.25 line height plus 1.5rem padding */}
            {() => (
              <div class="h-[calc(1.25em+1.5rem)] rounded bg-sub-alt pointer-coarse:min-h-11"></div>
            )}
          </For>
        </Skeleton>
      </Show>
    </section>
  );
}
