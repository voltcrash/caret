import type { SessionState } from "@oxytype/schemas/auth-session";

import { createForm } from "@tanstack/solid-form";
import { useQuery, useQueryClient } from "@tanstack/solid-query";
import { useRouter } from "@tanstack/solid-router";
import { createSignal, For, Show, onCleanup, createEffect } from "solid-js";
import { envConfig } from "virtual:env-config";

import { currentApplication, requireApplication } from "../../app/application";
import { Fa } from "../../ts/components/common/Fa";
import { Captcha } from "../../ts/components/ui/form/Captcha";
import { createAuthActions } from "./actions.client";
import { sessionOptions, authRedirect } from "./session";

export function AuthPanel(props: { initial: SessionState; redirect?: string }) {
  const router = useRouter();
  const client = useQueryClient();
  const session = useQuery(() => ({
    ...sessionOptions(),
    initialData: props.initial,
  }));
  const actions = createAuthActions(
    client,
    async () => await router.invalidate(),
  );
  const application = requireApplication();
  // Match the old signup dialog's dismissal behavior on route exit. A completed
  // profile or a different actor must never be cancelled by this page's cleanup.
  let signupActor: string | undefined;
  createEffect(() => {
    const user = session.data.user;
    signupActor = user?.registered === false ? user.uid : undefined;
  });
  onCleanup(() => {
    const user = client.getQueryData<SessionState>(
      sessionOptions().queryKey,
    )?.user;
    if (
      currentApplication() !== application ||
      user?.registered !== false ||
      user.uid !== signupActor
    ) {
      return;
    }
    void actions
      .cancel()
      .catch((error: unknown) =>
        console.error("Failed to cancel sign up", error),
      );
  });
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const [rememberMe, setRememberMe] = createSignal(true);
  const perform = async (
    action: () => Promise<void>,
    navigate = false,
  ): Promise<void> => {
    if (busy()) return;
    setBusy(true);
    setError(undefined);
    try {
      await action();
      if (
        navigate &&
        client.getQueryData<SessionState>(sessionOptions().queryKey)?.user
          ?.registered
      ) {
        await router.navigate({ to: authRedirect(props.redirect) });
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Authentication failed",
      );
    } finally {
      setBusy(false);
    }
  };
  const form = createForm(() => ({
    defaultValues: { name: "", captcha: "" },
    onSubmit: async ({ value }) => {
      try {
        await perform(
          async () => await actions.complete(value.name, value.captcha),
          true,
        );
      } finally {
        form.setFieldValue("captcha", "");
      }
    },
  }));
  const providers = () =>
    envConfig.authProviders.filter(
      (provider): provider is "google" | "github" =>
        provider === "google" || provider === "github",
    );
  return (
    <section class="grid max-w-md gap-4">
      <Show
        when={session.data.user}
        fallback={
          <>
            <p class="text-sub">New here? Sign in to create an account.</p>
            <Show
              when={session.data.signUpEnabled}
              fallback={
                <p>
                  Login/Signup is disabled or the server is down/under
                  maintenance.
                </p>
              }
            >
              <For each={providers()}>
                {(provider) => (
                  <button
                    type="button"
                    class="rounded bg-sub-alt p-3 text-text disabled:opacity-50"
                    disabled={busy()}
                    onClick={() =>
                      void perform(
                        async () => await actions.login(provider, rememberMe()),
                        true,
                      )
                    }
                  >
                    <Fa
                      icon={provider === "google" ? "fa-google" : "fa-github"}
                      variant="brand"
                    />{" "}
                    sign in with {provider === "google" ? "Google" : "GitHub"}
                  </button>
                )}
              </For>
              <label class="flex gap-2">
                <input
                  type="checkbox"
                  checked={rememberMe()}
                  onChange={(event) =>
                    setRememberMe(event.currentTarget.checked)
                  }
                  disabled={busy()}
                />
                remember me
              </label>
            </Show>
          </>
        }
      >
        {(user) => (
          <>
            <p>Signed in as {user().displayName}</p>
            <Show
              when={!user().registered}
              fallback={
                <>
                  <For each={providers()}>
                    {(provider) => (
                      <div class="flex gap-4">
                        <Show
                          when={user().providerData.some(
                            ({ providerId }) => providerId === provider,
                          )}
                          fallback={
                            <button
                              type="button"
                              class="rounded bg-sub-alt p-3"
                              disabled={busy()}
                              onClick={() =>
                                void perform(
                                  async () => await actions.link(provider),
                                )
                              }
                            >
                              link {provider}
                            </button>
                          }
                        >
                          <button
                            type="button"
                            class="rounded bg-sub-alt p-3"
                            disabled={busy()}
                            onClick={() =>
                              void perform(
                                async () =>
                                  await actions.reauthenticate(provider),
                              )
                            }
                          >
                            reauthenticate with {provider}
                          </button>
                          <button
                            type="button"
                            class="rounded bg-sub-alt p-3"
                            disabled={busy() || user().providerData.length < 2}
                            onClick={() =>
                              void perform(
                                async () => await actions.unlink(provider),
                              )
                            }
                          >
                            unlink {provider}
                          </button>
                        </Show>
                      </div>
                    )}
                  </For>
                  <button
                    type="button"
                    class="rounded bg-sub-alt p-3"
                    disabled={busy()}
                    onClick={() => void perform(actions.logout)}
                  >
                    sign out
                  </button>
                </>
              }
            >
              <p>Please enter a username before continuing</p>
              <form
                class="grid gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void form.handleSubmit();
                }}
              >
                <form.Field
                  name="name"
                  children={(field) => (
                    <label class="grid gap-2">
                      username
                      <input
                        class="rounded bg-sub-alt p-3 text-text"
                        required
                        maxLength={16}
                        value={field().state.value}
                        onInput={(event) =>
                          field().handleChange(event.currentTarget.value)
                        }
                        disabled={busy()}
                      />
                    </label>
                  )}
                />
                <form.Field
                  name="captcha"
                  children={(field) => (
                    <Captcha field={field} action="signup" />
                  )}
                />
                <button
                  class="rounded bg-sub-alt p-3"
                  type="submit"
                  disabled={busy()}
                >
                  continue
                </button>
              </form>
              <button
                type="button"
                class="rounded bg-sub-alt p-3"
                disabled={busy()}
                onClick={() => void perform(actions.cancel)}
              >
                cancel sign up
              </button>
            </Show>
          </>
        )}
      </Show>
      <Show when={busy()}>
        <p role="status">
          <Fa icon="fa-circle-notch" spin /> processing request
        </p>
      </Show>
      <Show when={error()}>
        <p role="alert" class="text-error">
          {error()}
        </p>
      </Show>
    </section>
  );
}
