import { User as UserType } from "@caret/schemas/users";
import {
  createEffect,
  createSignal,
  JSXElement,
  on,
  onCleanup,
  Show,
} from "solid-js";

import {
  getMatchingFlags,
  SupportsFlags,
  UserFlagOptions,
} from "../../controllers/user-flag-controller";
import { BreakpointKey } from "../../states/breakpoints";
import { cn } from "../../utils/cn";
import { applyReducedMotion } from "../../utils/misc";
import { Button } from "./Button";
import { Fa } from "./Fa";
import { FadeSwitch } from "./FadeSwitch";
import { UserAvatar } from "./UserAvatar";
import { UserBadge } from "./UserBadge";
import { UserFlags } from "./UserFlags";

type Props = {
  class?: string;
  user: SupportsFlags &
    Pick<UserType, "uid" | "name" | "xp"> & {
      badgeId?: number;
    };
  showAvatar?: boolean;
  avatarFallback?: "user" | "user-circle";
  avatarColor?: "text" | "sub";
  flagsColor?: "text" | "sub";
  hideNameOnSmallScreens?: boolean;
  linkToProfile?: boolean;
  level?: number;
  showSpinner?: boolean;
  fontClass?: "text-em-xs" | "text-em-sm" | "text-em-md" | "text-em-lg";
  hideBadgeTextOnWidth?: BreakpointKey;
} & UserFlagOptions;

const FLASH_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

export function User(props: Props): JSXElement {
  const [isAnimating, setIsAnimating] = createSignal(false);
  let levelEl: HTMLDivElement | undefined;
  let flashAnimation: Animation | undefined;

  createEffect(
    on(
      () => props.level,
      () => {
        const duration = applyReducedMotion(2000);
        if (!levelEl || duration <= 0) return;

        flashAnimation?.cancel();
        setIsAnimating(true);

        const rand = (Math.random() * 2 - 1) / 4;
        const rand2 = (Math.random() + 1) / 2;
        const current = levelEl.animate(
          {
            transform: [
              `scale(${1 + 0.5 * rand2}) rotate(${10 * rand}deg)`,
              "scale(1) rotate(0deg)",
            ],
            backgroundColor: [
              "var(--themable-button-active)",
              "var(--themable-button-text)",
            ],
          },
          { duration, easing: FLASH_EASE },
        );
        flashAnimation = current;
        void current.finished.then(
          () => {
            if (flashAnimation !== current) return;
            flashAnimation = undefined;
            setIsAnimating(false);
          },
          () => undefined,
        );
      },
      { defer: true },
    ),
  );

  onCleanup(() => {
    flashAnimation?.cancel();
    flashAnimation = undefined;
  });

  return (
    <div
      class={cn(
        "grid grid-flow-col place-items-center gap-[0.5em]",
        props.class,
      )}
    >
      <Show when={props.showAvatar ?? true}>
        <div class="relative w-[1.25em]" data-ui-element="navAvatar">
          <div class="grid place-items-center">
            <FadeSwitch value={props.showSpinner ?? false}>
              {(spinner) => (
                <Show
                  when={spinner()}
                  fallback={
                    <UserAvatar
                      fallbackIcon={props.avatarFallback ?? "user"}
                      class={cn(
                        props.avatarColor === "text" && "text-text",
                        props.avatarColor === "sub" && "text-sub",
                      )}
                    />
                  }
                >
                  <Fa icon={"fa-circle-notch"} spin={true} />
                </Show>
              )}
            </FadeSwitch>
          </div>
        </div>
      </Show>
      <div
        class={cn("min-w-0 truncate", props.fontClass, {
          "hidden sm:block": props.hideNameOnSmallScreens,
        })}
      >
        <Show when={props.linkToProfile ?? false} fallback={props.user.name}>
          <Button
            variant="text"
            href={`/profile/${props.user.name}`}
            text={props.user.name}
            router-link
            class="px-0"
          />
        </Show>
      </div>

      <Show when={getMatchingFlags(props.user).length > 0}>
        <div
          class={cn(
            "flex items-center justify-center gap-[0.5em]",
            cn(
              props.flagsColor === "text" && "text-text",
              props.flagsColor === "sub" && "text-sub",
            ),
          )}
        >
          <UserFlags {...props.user} iconsOnly={props.iconsOnly} />
        </div>
      </Show>
      <Show when={props.user.badgeId !== undefined}>
        <UserBadge
          id={props.user.badgeId}
          hideTextOnWidth={props.hideBadgeTextOnWidth}
        />
      </Show>
      <Show when={props.level !== undefined}>
        <div
          ref={(el) => (levelEl = el)}
          class={cn(
            "bg-(--themable-button-text) text-(--bg-color)",
            "rounded-half px-[0.5em] py-[0.1em] text-[0.7em]",
            { "transition-colors duration-125": !isAnimating() },
          )}
          data-ui-element="userLevel"
        >
          {props.level}
        </div>
      </Show>
    </div>
  );
}
