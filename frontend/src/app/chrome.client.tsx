import {
  createEffect,
  onCleanup,
  onMount,
  Show,
  type JSXElement,
} from "solid-js";
import { Portal, spread } from "solid-js/web";
import { envConfig } from "virtual:env-config";

import { Download } from "../ts/components/common/Download";
import { FilePicker } from "../ts/components/common/FilePicker";
import { bodyClass } from "../ts/components/core/body-classes";
import { BreakpointEvents } from "../ts/components/core/BreakpointEvents";
import { CustomBackground } from "../ts/components/core/CustomBackground";
import { GlobalEvents } from "../ts/components/core/GlobalEvents";
import { HotkeyEvents } from "../ts/components/core/HotkeyEvents";
import { SkillIssue } from "../ts/components/core/SkillIssue";
import { DevTools } from "../ts/components/dev/DevTools";
import { Footer } from "../ts/components/layout/footer/Footer";
import { Header } from "../ts/components/layout/header/Header";
import { Overlays } from "../ts/components/layout/overlays/Overlays";
import { usePageScroller } from "../ts/components/layout/PageScroller";
import { Modals } from "../ts/components/modals/Modals";
import { Popups } from "../ts/components/popups/Popups";
import { getAcceptedCookies } from "../ts/cookies";
import { addBanner, removeBanner } from "../ts/states/banners";
import { getGlobalOffsetTop } from "../ts/states/core";
import { showModal } from "../ts/states/modals";
import { getHeaderBottom } from "../ts/states/page-layout";
import * as ServerConfiguration from "../ts/states/server-configuration";
import { isFixingSkillIssue } from "../ts/states/skill-issue";
import { RouterNavigation } from "./navigation.client";
import { preferencesReadiness } from "./readiness";
import { isAppReady, isStartupFinished, setAppReady } from "./startup";

/**
 * Browser half of the common layout: overlays, global hotkeys, body classes,
 * banner offset and the page scroller registration. Owned by the layout;
 * removed with it.
 */
function ChromeRuntime(props: {
  fixed: boolean;
  scroller: HTMLElement | undefined;
  onHeaderBottom: (bottom: number) => void;
  onOffsetTop: (top: number) => void;
  onHidden: (hidden: boolean) => void;
}): JSXElement {
  usePageScroller(
    () => props.scroller,
    () => props.fixed,
  );
  createEffect(() => props.onHeaderBottom(getHeaderBottom()));
  createEffect(() => props.onOffsetTop(getGlobalOffsetTop()));
  createEffect(() => props.onHidden(isFixingSkillIssue()));
  spread(
    document.body,
    {
      get class() {
        return bodyClass(document.body.className);
      },
      get style() {
        return {
          // Theme changes animate only once stored preferences are applied.
          transition: isAppReady()
            ? "background .25s, transform .05s"
            : undefined,
        };
      },
    },
    false,
    true,
  );
  onMount(() => {
    if (!envConfig.devOffline) return;
    const banner = addBanner({
      level: "notice",
      text: "Frontend-only development: authentication and backend requests are disabled.",
    });
    onCleanup(() => removeBanner(banner));
  });
  onMount(() => {
    let disposed = false;
    onCleanup(() => {
      disposed = true;
    });
    // Server configuration and authentication are independent startup requests.
    void ServerConfiguration.sync().catch((error: unknown) =>
      console.error("Failed to synchronize server configuration", error),
    );
    // Reveal the app even if preferences fail; a stuck cover hides the error.
    void preferencesReadiness()
      .wait()
      .catch(() => undefined)
      .then(() => {
        if (!disposed) setAppReady(true);
      });
  });
  let cookiePrompted = false;
  createEffect(() => {
    if (cookiePrompted || !isStartupFinished()) return;
    cookiePrompted = true;
    if (getAcceptedCookies() === null) showModal("Cookies");
  });
  return (
    <>
      <RouterNavigation />
      <GlobalEvents />
      <HotkeyEvents />
      <BreakpointEvents />
      <Portal>
        <Download />
        <FilePicker />
        <Overlays scrollToTop={!props.fixed} />
        <CustomBackground />
        <div id="solidmodals">
          <Modals />
        </div>
        <div id="solidpopups">
          <Popups />
        </div>
        <DevTools />
        <Show when={isFixingSkillIssue()}>
          <SkillIssue />
        </Show>
      </Portal>
    </>
  );
}

/** Browser modules of the common layout, loaded together after hydration. */
export const chrome = { Header, Footer, Runtime: ChromeRuntime };
