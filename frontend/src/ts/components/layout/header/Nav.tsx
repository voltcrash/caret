import { useQuery } from "@tanstack/solid-query";
import {
  createSignal,
  JSXElement,
  lazy,
  Suspense,
  onCleanup,
  Show,
} from "solid-js";

import { isStartupFinished } from "../../../../app/startup";
import { AccountSlot } from "../../../../components/layout/account-slot";
import { createEffectOn } from "../../../hooks/effects";
import { useRef } from "../../../hooks/useRef";
import { getServerConfigurationQueryOptions } from "../../../queries/server-configuration";
import {
  getAccountButtonSpinner,
  getAnimatedLevel,
  setAnimatedLevel,
} from "../../../states/header";
import { showModal } from "../../../states/modals";
import { getSnapshot } from "../../../states/snapshot";
import { getFocus } from "../../../states/test";
import { cn } from "../../../utils/cn";
import { getLevelFromTotalXp } from "../../../utils/levels";
import { isCoarsePointer } from "../../../utils/pointer";
import { Button } from "../../common/Button";
const User = lazy(async () =>
  import("../../common/User").then((m) => ({ default: m.User })),
);
const AccountMenu = lazy(async () =>
  import("./AccountMenu").then((m) => ({ default: m.AccountMenu })),
);
const AccountXpBar = lazy(async () =>
  import("./AccountXpBar").then((m) => ({ default: m.AccountXpBar })),
);

export function Nav(): JSXElement {
  const [getAccountMenuOpen, setAccountMenuOpen] = createSignal(false);
  const [accountMenuRef, accountMenuEl] = useRef<HTMLDivElement>();

  const handleClickOutside = (e: MouseEvent) => {
    const el = accountMenuEl();
    if (getAccountMenuOpen() && el && !el.contains(e.target as Node)) {
      setAccountMenuOpen(false);
    }
  };
  document.addEventListener("click", handleClickOutside);
  onCleanup(() => document.removeEventListener("click", handleClickOutside));

  // touch: the icon stays 36px so the row fits 320px, the invisible ring
  // around it makes the tap target 44px
  const touchTargetClass =
    "pointer-coarse:relative pointer-coarse:before:absolute pointer-coarse:before:-inset-1 pointer-coarse:before:content-['']";

  const buttonClass = () =>
    cn("aspect-square", touchTargetClass, {
      "opacity-(--nav-focus-opacity)": getFocus(),
    });

  createEffectOn(getSnapshot, (snapshot) => {
    if (snapshot === undefined) {
      setAnimatedLevel(0);
      return;
    }
    setAnimatedLevel(getLevelFromTotalXp(snapshot.xp ?? 0));
  });

  const serverConfig = useQuery(() => ({
    ...getServerConfigurationQueryOptions(),
    enabled: isStartupFinished(),
  }));
  const showLoginButton = (): boolean =>
    serverConfig.data?.users.signUp ?? true;

  return (
    // phones under 426px: no gaps so the row fits 320px with touch targets
    <nav
      aria-label="Main navigation"
      class={cn("z-5 flex w-full items-center gap-0 xs:gap-1 md:gap-2")}
    >
      <Button
        variant="text"
        fa={{
          icon: "fa-crown",
          fixedWidth: true,
        }}
        router-link
        dataset={{
          "data-nav-item": "leaderboards",
          "aria-label": "Leaderboards",
        }}
        class={buttonClass()}
        href="/leaderboards"
      />
      <Button
        variant="text"
        fa={{
          icon: "fa-github",
          variant: "brand",
          fixedWidth: true,
        }}
        class={buttonClass()}
        dataset={{
          "data-nav-item": "github",
          "aria-label": "GitHub",
        }}
        href="https://github.com/voltcrash/caret"
      />
      <Button
        variant="text"
        fa={{
          icon: "fa-cog",
          fixedWidth: true,
        }}
        class={buttonClass()}
        href="/settings"
        dataset={{
          "data-nav-item": "settings",
          "aria-label": "Settings",
        }}
        router-link
      />
      <Button
        variant="text"
        fa={{ icon: "fa-circle-info", fixedWidth: true }}
        class={buttonClass()}
        href="/about"
        dataset={{
          "data-nav-item": "about",
          "aria-label": "About Caret",
        }}
        router-link
      />
      {/* touch has no ctrl+shift+p or esc, so the palette gets a nav button */}
      <Button
        variant="text"
        fa={{
          icon: "fa-terminal",
          fixedWidth: true,
        }}
        class={cn(buttonClass(), "hidden pointer-coarse:inline-flex")}
        dataset={{
          "data-nav-item": "commandline",
          "aria-label": "Command palette",
        }}
        onClick={() => {
          showModal("Commandline");
        }}
      />
      <AccountSlot>
        <Show
          when={getSnapshot()}
          fallback={
            <div class="min-w-0 max-w-full motion-safe:animate-content-in">
              <Show when={showLoginButton()}>
                <Button
                  variant="text"
                  href="/login"
                  dataset={{
                    "data-nav-item": "login",
                    "aria-label": "Sign in",
                  }}
                  fa={{
                    icon: "fa-user",
                    variant: "regular",
                    fixedWidth: true,
                  }}
                  router-link
                  class={buttonClass()}
                />
              </Show>
            </div>
          }
        >
          {(snap) => (
            <div class="min-w-0 max-w-full motion-safe:animate-content-in">
              <div
                ref={accountMenuRef}
                class={cn(
                  "relative",
                  !getFocus() &&
                    "pointer-fine:hover:**:data-[ui-element='accountMenu']:pointer-events-auto pointer-fine:hover:**:data-[ui-element='accountMenu']:opacity-100",
                  "has-focus-visible:**:data-[ui-element='accountMenu']:pointer-events-auto has-focus-visible:**:data-[ui-element='accountMenu']:opacity-100",
                  getAccountMenuOpen() &&
                    "**:data-[ui-element='accountMenu']:pointer-events-auto **:data-[ui-element='accountMenu']:opacity-100",
                )}
                on:click={(e: MouseEvent) => {
                  if (isCoarsePointer()) {
                    if (e.target instanceof HTMLAnchorElement) {
                      if (e.target.dataset["navItem"] === "account") {
                        e.preventDefault();
                        e.stopPropagation();
                      }
                      setAccountMenuOpen((prev) => !prev);
                    }
                  }
                }}
              >
                <Button
                  variant="text"
                  class={cn(
                    "h-9 min-w-0 max-w-full",
                    touchTargetClass,
                    "hover:**:data-[ui-element='userLevel']:bg-(--themable-button-hover-text)",
                    { "opacity-(--nav-focus-opacity)": getFocus() },
                  )}
                  href="/account"
                  router-link
                  dataset={{
                    "data-nav-item": "account",
                    "aria-label": "Account",
                  }}
                >
                  <Suspense
                    fallback={<span class="text-em-xs">{snap().name}</span>}
                  >
                    <User
                      class="min-w-0 max-w-full auto-cols-[minmax(0,max-content)] motion-safe:animate-content-in"
                      user={snap()}
                      showAvatar={false}
                      iconsOnly={true}
                      hideNameOnSmallScreens={true}
                      level={getAnimatedLevel()}
                      showSpinner={getAccountButtonSpinner()}
                      fontClass="text-em-xs"
                    />
                  </Suspense>
                </Button>
                <Suspense fallback={null}>
                  <AccountMenu />
                </Suspense>
              </div>
              <div class="relative">
                <Suspense fallback={null}>
                  <AccountXpBar />
                </Suspense>
              </div>
            </div>
          )}
        </Show>
      </AccountSlot>
    </nav>
  );
}
