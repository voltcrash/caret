import { createForm } from "@tanstack/solid-form";
import { JSXElement, Show } from "solid-js";
import { envConfig } from "virtual:env-config";

import {
  AuthResult,
  getAuthMethodDisplay,
  signInWithProvider,
} from "../../../auth";
import {
  disableLoginPageInputs,
  enableLoginPageInputs,
  getLoginPageInputsEnabled,
} from "../../../states/login";
import { showErrorNotification } from "../../../states/notifications";
import { Button } from "../../common/Button";
import { H3 } from "../../common/Headers";
import { Checkbox } from "../../ui/form/Checkbox";

export function Login(): JSXElement {
  const trySignIn = async (
    auth: () => Promise<AuthResult>,
    label: string,
  ): Promise<void> => {
    disableLoginPageInputs();
    try {
      const data = await auth();
      if (!data.success) {
        showErrorNotification(
          `Failed to sign in with ${label}: ${data.message}`,
        );
      }
    } finally {
      enableLoginPageInputs();
    }
  };

  const form = createForm(() => ({
    defaultValues: { rememberMe: true },
  }));

  return (
    <div class="grid w-full grid-cols-1 justify-center gap-4 sm:w-80">
      <H3 text="sign in" fa={{ icon: "fa-sign-in-alt" }} class="p-0" />
      <p class="text-sub">New here? Sign in to create an account.</p>
      <Show when={envConfig.authProviders.includes("google")}>
        <Button
          text="sign in with Google"
          class="w-full pointer-coarse:min-h-11"
          fa={{ icon: "fa-google", variant: "brand" }}
          onClick={() =>
            void trySignIn(
              async () =>
                signInWithProvider("google", {
                  rememberMe: form.getFieldValue("rememberMe"),
                }),
              getAuthMethodDisplay("google"),
            )
          }
          disabled={!getLoginPageInputsEnabled()}
        />
      </Show>
      <Show when={envConfig.authProviders.includes("github")}>
        <Button
          text="sign in with GitHub"
          class="w-full pointer-coarse:min-h-11"
          fa={{ icon: "fa-github", variant: "brand" }}
          onClick={() =>
            void trySignIn(
              async () =>
                signInWithProvider("github", {
                  rememberMe: form.getFieldValue("rememberMe"),
                }),
              getAuthMethodDisplay("github"),
            )
          }
          disabled={!getLoginPageInputsEnabled()}
        />
      </Show>
      <form.Field
        name="rememberMe"
        children={(field) => (
          <Checkbox
            field={field}
            disabled={!getLoginPageInputsEnabled()}
            label="remember me"
          />
        )}
      />
    </div>
  );
}
