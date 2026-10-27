import type { SessionState } from "@caret/schemas/auth-session";

import { createForm } from "@tanstack/solid-form";
import { useQuery, useQueryClient } from "@tanstack/solid-query";
import { useRouter } from "@tanstack/solid-router";
import { createSignal, For, Show, onCleanup, createEffect } from "solid-js";
import { envConfig } from "virtual:env-config";

import { currentApplication, requireApplication } from "../../app/application";
import { Button } from "../../ts/components/common/Button";
import { Fa } from "../../ts/components/common/Fa";
import { Captcha } from "../../ts/components/ui/form/Captcha";
import { SubmitButton } from "../../ts/components/ui/form/SubmitButton";
import { allFieldsMandatory } from "../../ts/components/ui/form/utils";
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
    validators: { onChange: allFieldsMandatory() },
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
  const providerName = (provider: "google" | "github") =>
    provider === "google" ? "Google" : "GitHub";
  const providerIcon = (provider: "google" | "github") =>
    provider === "google" ? "fa-google" : "fa-github";
  const inputClass =
    "w-full rounded bg-sub-alt p-[0.5em] text-text outline-none placeholder:text-sub focus-visible:shadow-[0_0_0_0.1rem_var(--bg-color),_0_0_0_0.2rem_var(--text-color)] disabled:opacity-[0.33]";
  return (
    <section class="grid gap-4">
      <Show
        when={session.data.user}
        fallback={
          <Show
            when={session.data.signUpEnabled}
            fallback={
              <p class="text-sub">
                Login/Signup is disabled or the server is down/under
                maintenance.
              </p>
            }
          >
            <p class="text-sub">New here? Signing in creates an account.</p>
            <div class="grid gap-2">
              <For each={providers()}>
                {(provider) => (
                  <Button
                    text={`sign in with ${providerName(provider)}`}
                    fa={{ icon: providerIcon(provider), variant: "brand" }}
                    class="w-full p-3"
                    disabled={busy()}
                    onClick={() =>
                      void perform(
                        async () => await actions.login(provider),
                        true,
                      )
                    }
                  />
                )}
              </For>
            </div>
          </Show>
        }
      >
        {(user) => (
          <>
            <p class="text-sub">Signed in as {user().displayName}</p>
            <Show
              when={!user().registered}
              fallback={
                <>
                  <div class="grid gap-2">
                    <For each={providers()}>
                      {(provider) => (
                        <Show
                          when={user().providerData.some(
                            ({ providerId }) => providerId === provider,
                          )}
                          fallback={
                            <Button
                              text={`link ${providerName(provider)}`}
                              fa={{
                                icon: providerIcon(provider),
                                variant: "brand",
                              }}
                              class="w-full p-3"
                              disabled={busy()}
                              onClick={() =>
                                void perform(
                                  async () => await actions.link(provider),
                                )
                              }
                            />
                          }
                        >
                          <div class="grid grid-cols-[1fr_auto] gap-2">
                            <Button
                              text={`reauthenticate with ${providerName(provider)}`}
                              fa={{
                                icon: providerIcon(provider),
                                variant: "brand",
                              }}
                              class="p-3"
                              disabled={busy()}
                              onClick={() =>
                                void perform(
                                  async () =>
                                    await actions.reauthenticate(provider),
                                )
                              }
                            />
                            <Button
                              text="unlink"
                              class="p-3"
                              disabled={
                                busy() || user().providerData.length < 2
                              }
                              onClick={() =>
                                void perform(
                                  async () => await actions.unlink(provider),
                                )
                              }
                            />
                          </div>
                        </Show>
                      )}
                    </For>
                  </div>
                  <Button
                    text="sign out"
                    fa={{ icon: "fa-sign-out-alt" }}
                    class="w-full p-3"
                    disabled={busy()}
                    onClick={() => void perform(actions.logout)}
                  />
                </>
              }
            >
              <p class="text-sub">Pick a username to finish signing up.</p>
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
                      <span class="text-sub">username</span>
                      <input
                        class={inputClass}
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
                <div class="grid grid-cols-2 gap-2">
                  <Button
                    text="cancel sign up"
                    class="p-3"
                    disabled={busy()}
                    onClick={() => void perform(actions.cancel)}
                  />
                  <SubmitButton
                    form={form}
                    text="continue"
                    class="p-3"
                    disabled={busy()}
                  />
                </div>
              </form>
            </Show>
          </>
        )}
      </Show>
      <Show when={busy()}>
        <p role="status" class="text-sub">
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
