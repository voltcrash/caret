import { For, JSXElement, onMount, Show } from "solid-js";

import { createEffectOn } from "../../../hooks/effects";
import {
  Banner as BannerType,
  addBanner,
  getBanners,
  removeBanner,
} from "../../../states/banners";
import { getSnapshot } from "../../../states/snapshot";
import { cn } from "../../../utils/cn";
import { isProfilerMode } from "../../../utils/profiler-mode";
import { Fa, FaProps } from "../../common/Fa";
import { showUpdateNameModal } from "../../modals/account-settings/UpdateNameModal";

function Banner(props: BannerType): JSXElement {
  const remove = (): void => {
    removeBanner(props.id);
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
        "pointer-events-auto w-full rounded border border-solid bg-sub-alt px-3 text-sm text-text motion-safe:animate-content-in [&_a]:text-main [&_a]:underline [&_a]:hover:text-text",
        {
          "border-error": props.level === "error",
          "border-sub": props.level === "notice",
          "border-main": props.level === "success",
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
              class="text -mr-2 min-h-11 min-w-11 items-center self-center text-sub hover:text-text sm:min-h-0 sm:min-w-0 sm:items-baseline"
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

  onMount(() => {
    if (isProfilerMode()) {
      addBanner({
        level: "error",
        icon: "fas fa-stopwatch",
        text: "Profiler mode enabled",
        important: true,
      });
    }
  });

  return (
    // Announcements arrive after startup; keep them out of the app's geometry.
    <div
      role="region"
      aria-label="Announcements"
      aria-live="polite"
      class="pointer-events-none fixed inset-x-0 bottom-0 z-1000 mx-auto grid max-h-[30dvh] w-full max-w-2xl gap-2 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
    >
      <For each={getBanners()}>{(banner) => <Banner {...banner} />}</For>
    </div>
  );
}
