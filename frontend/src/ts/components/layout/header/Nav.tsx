import { useQuery } from "@tanstack/solid-query";
import {
  createMemo,
  createSignal,
  JSXElement,
  lazy,
  Suspense,
  onCleanup,
  Show,
} from "solid-js";

import { restartTestEvent } from "../../../events/test";
import { createEffectOn } from "../../../hooks/effects";
import { useRef } from "../../../hooks/useRef";
import {
  prefetchAboutPage,
  prefetchLeaderboardPage,
} from "../../../queries/prefetch";
import { getServerConfigurationQueryOptions } from "../../../queries/server-configuration";
import { getActivePage } from "../../../states/core";
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
import { Anime } from "../../common/anime";
import { AnimePresence } from "../../common/anime/AnimePresence";
import { Button } from "../../common/Button";
import { NotificationBubble } from "../../common/NotificationBubble";
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

  const showAlertsNotificationBubble = createMemo((): boolean => {
    const snapshot = getSnapshot();
    if (snapshot === undefined) return false;

    return snapshot.inboxUnreadSize > 0;
  });

  const serverConfig = useQuery(() => getServerConfigurationQueryOptions());
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
          icon: "fa-keyboard",
          fixedWidth: true,
        }}
        router-link
        href="/"
        class={buttonClass()}
        dataset={{
          "data-nav-item": "test",
          "aria-label": "Test",
        }}
        onClick={() => {
          if (getActivePage() === "test") restartTestEvent.dispatch();
        }}
      />
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
        onMouseEnter={() => {
          prefetchLeaderboardPage();
        }}
      />
      <Button
        variant="text"
        fa={{
          icon: "fa-info",
          fixedWidth: true,
        }}
        class={buttonClass()}
        dataset={{
          "data-nav-item": "about",
          "aria-label": "About",
        }}
        href="/about"
        router-link
        onMouseEnter={() => {
          prefetchAboutPage();
        }}
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
      <div class="grow"></div>
      <Button
        variant="text"
        fa={{
          icon: "fa-bell",
          fixedWidth: true,
        }}
        dataset={{
          "data-nav-item": "alerts",
          "aria-label": "Alerts",
        }}
        onClick={() => {
          showModal("Alerts");
        }}
        class={cn(buttonClass(), "relative")}
      >
        <NotificationBubble
          variant="fromCorner"
          show={showAlertsNotificationBubble()}
        />
      </Button>
      <AnimePresence exitBeforeEnter>
        <Show
          when={getSnapshot()}
          fallback={
            <Anime
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, duration: 125 }}
              exit={{ opacity: 0, duration: 125 }}
            >
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
            </Anime>
          }
        >
          {(snap) => (
            <Anime
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, duration: 125 }}
              exit={{ opacity: 0, duration: 125 }}
            >
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
                    "h-full",
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
                  <Suspense fallback={null}>
                    <User
                      user={snap()}
                      showAvatar={true}
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
            </Anime>
          )}
        </Show>
      </AnimePresence>
    </nav>
  );
}
