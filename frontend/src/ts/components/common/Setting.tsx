import {
  JSXElement,
  ParentProps,
  Show,
  onMount,
  onCleanup,
  useContext,
} from "solid-js";
import { z } from "zod";
import { serialize } from "zod-urlsearchparams";

import { useRef } from "../../hooks/useRef";
import { replaceUrl } from "../../navigation/navigation";
import {
  showErrorNotification,
  showSuccessNotification,
} from "../../states/notifications";
import {
  getHighlightedSetting,
  setHighlightedSetting,
  registerSettingHighlight,
} from "../../states/settings-highlight";
import { cn } from "../../utils/cn";
import { SettingsSectionContext } from "../pages/settings/settings-section-context";
import { Button } from "./Button";
import { FaProps } from "./Fa";
import { H3 } from "./Headers";

export type SettingProps = {
  title: string | JSXElement;
  fa: FaProps;
  description: string | JSXElement;
  inputs?: JSXElement;
  fullWidthInputs?: JSXElement;
  titleActions?: JSXElement;
  breakpoints?: "none" | "normal" | "narrow";
  class?: string;
  // called when a deep link targets this setting, before it is scrolled to
  onHighlight?: () => void;
} & ParentProps &
  (
    | {
        /**
         * data-settings-key
         */
        key: string;
        showDeepLink?: true;
      }
    | {
        key?: never;
        showDeepLink: false;
      }
  ) &
  (
    | {
        disabled: boolean;
        disabledDescription: JSXElement;
      }
    | {
        disabled?: never;
        disabledDescription?: never;
      }
  );

export function Setting(props: SettingProps): JSXElement {
  const [ref, element] = useRef<HTMLDivElement>();
  onMount(() => {
    if (props.key === undefined) return;
    const key = props.key;
    let timer: ReturnType<typeof setTimeout> | undefined;
    onCleanup(
      registerSettingHighlight(key, () => {
        props.onHighlight?.();
        timer = setTimeout(() => {
          element()?.scrollIntoView({ block: "center", behavior: "auto" });
          setHighlightedSetting(key);
        }, 250);
      }),
    );
    onCleanup(() => clearTimeout(timer));
  });
  const breakpoints = () => props.breakpoints ?? "normal";
  return (
    <div
      ref={ref}
      class={cn(
        // single track capped at the card width so wide children can't push
        // the card (and its option rows) past the screen on phones
        "group grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 max-md:gap-3",
        "-m-4 rounded-double p-4",
        // "animate-[ring-flash_4s_ease-in_forwards]",
        props.class,
        props.key !== undefined &&
          getHighlightedSetting() === props.key &&
          "settings-highlight",
      )}
      {...("key" in props && props.key !== undefined
        ? { "data-setting-key": props.key }
        : {})}
    >
      <div class="flex flex-wrap items-center gap-2">
        <H3 text={props.title} fa={props.fa} class="pb-0" />
        {props.titleActions}
        <Show when={props.showDeepLink !== false}>
          <DeepLinkButton key={(props as { key: string }).key} />
        </Show>
      </div>

      <Show
        when={props.disabled === undefined || !props.disabled}
        fallback=<div>{props.disabledDescription}</div>
      >
        <div
          class={cn(
            "grid grid-cols-1 gap-2",
            breakpoints() === "normal" &&
              "md:grid-cols-[1fr_1fr] md:gap-x-8 lg:grid-cols-[1.5fr_1fr] xl:grid-cols-[2fr_1fr]",

            breakpoints() === "narrow" &&
              "md:gap-x-8 lg:grid lg:grid-cols-2 xl:grid-cols-[2fr_1fr]",

            props.inputs === undefined &&
              breakpoints() === "normal" &&
              "grid-cols-1 md:grid-cols-1 lg:grid-cols-1 xl:grid-cols-1",
          )}
        >
          <Show when={props.description !== ""}>
            <div>{props.description}</div>
          </Show>
          <Show when={props.inputs !== undefined}>
            <div>{props.inputs}</div>
          </Show>
          <Show when={props.children}>
            <div>{props.children}</div>
          </Show>
        </div>

        <Show when={props.fullWidthInputs}>{props.fullWidthInputs}</Show>
      </Show>
    </div>
  );
}

function DeepLinkButton(props: { key: string }) {
  const section = useContext(SettingsSectionContext);
  return (
    <Button
      // tablets have no hover, keep it visible there
      class="-m-2 p-2 opacity-100 sm:pointer-fine:opacity-0 sm:pointer-fine:group-hover:opacity-100 sm:pointer-fine:focus-visible:opacity-100"
      variant="text"
      fa={{ icon: "fa-link" }}
      dataset={{ "aria-label": "Copy link to setting" }}
      onClick={() => {
        // the link opens this setting's section, then highlights it
        const urlParams = serialize({
          schema: z.object({
            tab: z.string().optional(),
            highlight: z.string(),
          }),
          data: {
            tab: section,
            highlight: props.key,
          },
        });
        const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
        replaceUrl(newUrl)
          .then(async () =>
            navigator.clipboard.writeText(window.location.toString()),
          )
          .then(() => {
            showSuccessNotification("Link copied to clipboard");
          })
          .catch((e: unknown) => {
            showErrorNotification("Failed to copy to clipboard", {
              error: e,
            });
          });
      }}
    />
  );
}
