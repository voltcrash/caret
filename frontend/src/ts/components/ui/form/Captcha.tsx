import type { CaptchaAction } from "@caret/contracts/captcha";

import { AnyFieldApi } from "@tanstack/solid-form";
import {
  Accessor,
  Show,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import { envConfig } from "virtual:env-config";

import { useRef } from "../../../hooks/useRef";
import { Button } from "../../common/Button";

const errorText =
  "Turnstile verification unavailable. Check that Cloudflare challenges are allowed by your browser, then retry verification.";
const scriptId = "turnstile-api";

export type TurnstileOptions = {
  sitekey: string;
  action: CaptchaAction;
  theme: "auto";
  size: "flexible";
  "response-field": false;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "timeout-callback": () => void;
  "error-callback": (code?: string) => void;
};
export type TurnstileApi = {
  render: (element: HTMLElement, options: TurnstileOptions) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

type CaptchaProps = {
  field: Accessor<AnyFieldApi>;
  action: CaptchaAction;
  class?: string;
};

export function Captcha(props: CaptchaProps) {
  const [attempt, setAttempt] = createSignal(1);
  const retry = (): void => {
    if (
      (window as Window & { turnstile?: TurnstileApi }).turnstile === undefined
    ) {
      document.getElementById(scriptId)?.remove();
    }
    setAttempt((value) => value + 1);
  };
  return (
    <Show keyed when={attempt()}>
      {(_attempt) => <CaptchaWidget {...props} retry={retry} />}
    </Show>
  );
}

function CaptchaWidget(props: CaptchaProps & { retry: () => void }) {
  const [captchaRef, captchaEl] = useRef<HTMLDivElement>();
  const [error, setError] = createSignal(false);
  const [errorCode, setErrorCode] = createSignal<string>();
  let api: TurnstileApi | undefined;
  let widget: string | undefined;
  let token: string | undefined;
  let disposed = false;

  const clearToken = (): void => {
    token = undefined;
    props.field().setValue("");
  };

  // Forms clear a consumed token after each request, including failed requests.
  createEffect(() => {
    const value = props.field().state.value as string;
    if (value === "" && token !== undefined && widget !== undefined) {
      token = undefined;
      api?.reset(widget);
    }
  });

  onMount(() => {
    const el = captchaEl();
    if (el === undefined) return;
    const field = props.field();
    const action = props.action;
    clearToken();
    let script: HTMLScriptElement | undefined;
    const fail = (): void => {
      if (disposed) return;
      clearToken();
      setError(true);
    };
    const timer = window.setTimeout(fail, 15_000);
    const loaded = (): void => {
      if (disposed || widget !== undefined) return;
      api = (window as Window & { turnstile?: TurnstileApi }).turnstile;
      if (api === undefined) {
        fail();
        return;
      }
      // The script load event supplies readiness. ready() rejects async scripts.
      window.clearTimeout(timer);
      try {
        widget = api.render(el, {
          sitekey: envConfig.turnstileSiteKey,
          action,
          theme: "auto",
          size: "flexible",
          "response-field": false,
          callback: (value) => {
            if (disposed) return;
            token = value;
            setError(false);
            setErrorCode(undefined);
            field.setValue(value);
          },
          "expired-callback": () => {
            if (!disposed) clearToken();
          },
          "timeout-callback": () => {
            if (!disposed) clearToken();
          },
          "error-callback": (code) => {
            if (disposed) return;
            setErrorCode(code);
            fail();
          },
        });
        if (widget === undefined) fail();
      } catch {
        fail();
      }
    };

    if ("turnstile" in window) {
      loaded();
    } else {
      const existing = document.getElementById(
        scriptId,
      ) as HTMLScriptElement | null;
      script = existing ?? document.createElement("script");
      script.addEventListener("load", loaded);
      script.addEventListener("error", fail);
      if (existing === null) {
        script.id = scriptId;
        script.src =
          "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        document.head.append(script);
      }
    }

    onCleanup(() => {
      disposed = true;
      window.clearTimeout(timer);
      script?.removeEventListener("load", loaded);
      script?.removeEventListener("error", fail);
      if (widget !== undefined) api?.remove(widget);
      clearToken();
    });
  });

  return (
    <div class={props.class}>
      <div ref={captchaRef}></div>
      <Show when={error()}>
        <div class="grid gap-2">
          <p role="alert" class="text-sm text-error">
            {errorText}
            <Show when={errorCode()}>
              {(code) => <> (Cloudflare error {code()})</>}
            </Show>
          </p>
          <Button text="retry verification" onClick={props.retry} />
        </div>
      </Show>
    </div>
  );
}
