import { createSignal, JSXElement, Show, onMount, onCleanup } from "solid-js";

import {
  getBackground,
  getBackgroundSize,
  getBackgroundStyle,
} from "../../states/background";
import {
  removeNotification,
  showNoticeNotification,
} from "../../states/notifications";
import { cn } from "../../utils/cn";

function BackgroundImage(props: { url: string }): JSXElement {
  const [failed, setFailed] = createSignal(false);
  return (
    <img
      src={props.url}
      alt=""
      class={cn(failed() && "hidden")}
      style={{
        ...getBackgroundStyle(),
        "object-fit": getBackgroundSize() || undefined,
      }}
      onError={() => {
        setFailed(true);
        window.dispatchEvent(new Event("customBackgroundFailed"));
      }}
    />
  );
}

export function CustomBackground(): JSXElement {
  onMount(() => {
    let failureNotice: number | undefined;
    let blockedUrl: string | undefined;
    const failed = (): void => {
      if (blockedUrl === getBackground().url) return;
      if (failureNotice !== undefined) removeNotification(failureNotice);
      failureNotice = showNoticeNotification(
        "Custom background link is either temporarily unavailable or expired. Please make sure the URL is correct or change it",
        { durationMs: 5000 },
      );
    };
    const blocked = (event: SecurityPolicyViolationEvent): void => {
      const url = getBackground().url;
      if (
        event.effectiveDirective !== "img-src" ||
        event.disposition === "report" ||
        url === "" ||
        event.blockedURI !== new URL(url, document.baseURI).href
      ) {
        return;
      }
      blockedUrl = url;
      if (failureNotice !== undefined) removeNotification(failureNotice);
      failureNotice = showNoticeNotification(
        "Your browser blocked this background image. Use a different image URL or upload a local image.",
        { durationMs: 5000 },
      );
    };
    window.addEventListener("customBackgroundFailed", failed);
    document.addEventListener("securitypolicyviolation", blocked);
    onCleanup(() => {
      window.removeEventListener("customBackgroundFailed", failed);
      document.removeEventListener("securitypolicyviolation", blocked);
    });
  });
  return (
    <div class="customBackground fixed top-0 left-0 -z-999 flex h-lvh w-screen items-center justify-center bg-center bg-no-repeat">
      <Show when={getBackground().url !== "" && getBackground()} keyed>
        {(background) => <BackgroundImage url={background.url} />}
      </Show>
    </div>
  );
}
