import { createSignal, Show } from "solid-js";
import { envConfig } from "virtual:env-config";

import {
  addAuthProvider,
  AuthMethod,
  getAuthMethodDisplay,
  getAuthMethodEmailReactive,
  getAuthMethodIcon,
  hasAdditionalAuthMethodsReactive,
  isUsingAuthenticationReactive,
} from "../../../../ts/auth";
import { Button } from "../../../../ts/components/common/Button";
import { showRevokeAllTokensModal } from "../../../../ts/components/modals/account-settings/ReauthConfirmModals";
import { showRemoveAuthMethodModal } from "../../../../ts/components/modals/account-settings/RemoveAuthMethodModal";
import { Section } from "./utils";

export function AuthenticationTab() {
  return (
    <>
      <Show
        when={
          envConfig.authProviders.includes("google") ||
          isUsingAuthenticationReactive("google")
        }
      >
        <ProviderAuthentication authMethod="google" />
      </Show>
      <Show
        when={
          envConfig.authProviders.includes("github") ||
          isUsingAuthenticationReactive("github")
        }
      >
        <ProviderAuthentication authMethod="github" />
      </Show>
      <RevokeAllTokens />
    </>
  );
}

function ProviderAuthentication(props: { authMethod: AuthMethod }) {
  return (
    <Section
      key={`authentication${getAuthMethodDisplay(props.authMethod)}`}
      title={`${getAuthMethodDisplay(props.authMethod)}`}
      fa={getAuthMethodIcon(props.authMethod)}
      description=<>
        Add or remove {getAuthMethodDisplay(props.authMethod)} authentication.
      </>
    >
      <div class="flex flex-col gap-2">
        <AuthEmail authMethod={props.authMethod} />
        <Show
          when={isUsingAuthenticationReactive(props.authMethod)}
          fallback=<Button
            class="w-full"
            text={`add ${getAuthMethodDisplay(props.authMethod)} authentication`}
            onClick={() =>
              void addAuthProvider({ authMethod: props.authMethod })
            }
          />
        >
          <Button
            class="w-full"
            text={`remove ${getAuthMethodDisplay(props.authMethod)} authentication`}
            disabled={!hasAdditionalAuthMethodsReactive(props.authMethod)}
            onClick={() =>
              showRemoveAuthMethodModal({ authMethod: props.authMethod })
            }
          />
        </Show>
      </div>
    </Section>
  );
}

function AuthEmail(props: { authMethod: AuthMethod }) {
  const [isRevealed, setIsRevealed] = createSignal(false);
  const email = () => getAuthMethodEmailReactive(props.authMethod);

  return (
    <Show when={email()}>
      {(value) => (
        <Button
          variant="text"
          class="w-full p-2 font-mono wrap-anywhere sm:p-1"
          fa={{ icon: isRevealed() ? "fa-eye-slash" : "fa-eye" }}
          text={isRevealed() ? value() : obfuscateEmail(value())}
          balloon={{
            text: isRevealed() ? "click to hide" : "click to reveal",
          }}
          onClick={() => setIsRevealed(!isRevealed())}
        />
      )}
    </Show>
  );
}

function obfuscateEmail(email: string): string {
  const atIndex = email.lastIndexOf("@");
  if (atIndex < 1) return maskAfterFirstCharacter(email);

  const domain = email.slice(atIndex + 1);
  const dotIndex = domain.lastIndexOf(".");
  const maskedDomain =
    dotIndex < 1
      ? maskAfterFirstCharacter(domain)
      : `${maskAfterFirstCharacter(domain.slice(0, dotIndex))}${domain.slice(dotIndex)}`;

  return `${maskAfterFirstCharacter(email.slice(0, atIndex))}@${maskedDomain}`;
}

function maskAfterFirstCharacter(value: string): string {
  if (value.length <= 1) return "\u2022".repeat(3);
  return `${value.slice(0, 1)}${"\u2022".repeat(value.length - 1)}`;
}

function RevokeAllTokens() {
  return (
    <Section
      key="revokeAllTokens"
      title="revoke all tokens"
      fa={{ icon: "fa-user-slash" }}
      description=<>
        Revokes all tokens connected to your account. Do this if you think
        someone else has access to your account.
        <br />
        <span class="text-error">This will log you out of all devices.</span>
      </>
      button={{
        text: "revoke all tokens",
        class:
          "[--themable-button-bg:var(--error-color)] [--themable-button-text:var(--bg-color)]",
        onClick: () => showRevokeAllTokensModal(),
      }}
    />
  );
}
