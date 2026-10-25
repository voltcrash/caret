import { debounce } from "@oxytype/util/timing";
import { For, JSXElement, onCleanup, onMount, Show } from "solid-js";

import { createEffectOn } from "../../../hooks/effects";
import { useRef } from "../../../hooks/useRef";
import {
  Banner as BannerType,
  addBanner,
  getBanners,
  removeBanner,
} from "../../../states/banners";
import { setGlobalOffsetTop } from "../../../states/core";
import { getSnapshot } from "../../../states/snapshot";
import { cn } from "../../../utils/cn";
import { isProfilerMode } from "../../../utils/profiler-mode";
import { Fa, FaProps } from "../../common/Fa";
import { showUpdateNameModal } from "../../modals/account-settings/UpdateNameModal";

function Banner(props: BannerType): JSXElement {
  const remove = (): void => {
    // document.startViewTransition(() => {
    removeBanner(props.id);
    // });
  };
  const icon = (): string =>
    props.icon === undefined || props.icon === ""
      ? "fa fa-fw fa-bullhorn"
      : props.icon;

  const fa = (): FaProps =>
    ({
      icon: icon(),
      variant: icon().split(" ").includes("fab")
        ? "brand"
        : icon().split(" ").includes("far")
          ? "regular"
          : "solid",
    }) as FaProps;

  return (
    <div
      class={cn(
        "content-grid w-full text-bg [&_a]:text-bg [&_a]:underline [&_a]:hover:text-text",
        {
          "bg-error": props.level === "error",
          "bg-sub": props.level === "notice",
          "bg-main": props.level === "success",
        },
      )}
    >
      <div class="flex w-full justify-between gap-2">
        <Show
          when={props.imagePath !== undefined}
          fallback={<Fa {...fa()} class="self-center" />}
        >
          <img
            src={props.imagePath}
            alt="Banner Image"
            class="hidden aspect-6/1 h-full max-h-9 self-center xl:block"
          />
          <Fa {...fa()} class="self-center xl:hidden" />
        </Show>
        <div class="min-w-0 grow self-center p-2 [overflow-wrap:anywhere]">
          {props.customContent ?? props.text}
        </div>
        <Show
          when={props.important === true}
          fallback={
            <button
              aria-label="Dismiss banner"
              type="button"
              class="text -mr-2 min-h-11 min-w-11 items-center self-center text-bg hover:text-text sm:min-h-0 sm:min-w-0 sm:items-baseline"
              onClick={() => {
                remove();
              }}
            >
              <Fa icon="fa-times" fixedWidth />
            </button>
          }
        >
          <Fa {...fa()} class="self-center" />
        </Show>
      </div>
    </div>
  );
}

export function Banners(): JSXElement {
  const [ref, element] = useRef();

  let nameChangeAdded = false;
  createEffectOn(
    () => getSnapshot()?.needsToChangeName,
    (needsToChange) => {
      if (needsToChange && !nameChangeAdded) {
        nameChangeAdded = true;
        addBanner({
          level: "error",
          icon: "fas fa-exclamation-triangle",
          customContent: (
            <>
              You need to update your account name.{" "}
              <button
                type="button"
                class="px-2 py-1"
                onClick={() => showUpdateNameModal()}
              >
                Click here
              </button>{" "}
              to change it and learn more about why.
            </>
          ),
          important: true,
        });
      }
    },
  );

  const setGlobalOffsetSignal = (): void => {
    const height = element()?.offsetHeight ?? 0;
    setGlobalOffsetTop(height);
  };

  const debouncedMarginUpdate = debounce(100, setGlobalOffsetSignal);

  onMount(() => {
    window.addEventListener("resize", debouncedMarginUpdate);
    if (isProfilerMode()) {
      addBanner({
        level: "error",
        icon: "fas fa-stopwatch",
        text: "Profiler mode enabled",
        important: true,
      });
    }
  });

  onCleanup(() => {
    window.removeEventListener("resize", debouncedMarginUpdate);
  });

  createEffectOn(() => getBanners().length, setGlobalOffsetSignal);

  return (
    // the first banner fills the status bar area of installed apps (notch)
    <div
      ref={ref}
      class="fixed top-0 left-0 z-1000 w-full [&>:first-child]:pt-[env(safe-area-inset-top,0px)]"
    >
      <For each={getBanners()}>{(banner) => <Banner {...banner} />}</For>
    </div>
  );
}
