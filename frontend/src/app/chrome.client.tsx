import { createEffect, onCleanup, onMount, type JSXElement } from "solid-js";
import { Portal, spread } from "solid-js/web";

import * as ServerConfiguration from "../ts/ape/server-configuration";
import { Download } from "../ts/components/common/Download";
import { FilePicker } from "../ts/components/common/FilePicker";
import { bodyClass } from "../ts/components/core/body-classes";
import { BreakpointEvents } from "../ts/components/core/BreakpointEvents";
import { CustomBackground } from "../ts/components/core/CustomBackground";
import { GlobalEvents } from "../ts/components/core/GlobalEvents";
import { HotkeyEvents } from "../ts/components/core/HotkeyEvents";
import { Footer } from "../ts/components/layout/footer/Footer";
import { Header } from "../ts/components/layout/header/Header";
import { Overlays } from "../ts/components/layout/overlays/Overlays";
import { usePageScroller } from "../ts/components/layout/PageScroller";
import { Modals } from "../ts/components/modals/Modals";
import { Popups } from "../ts/components/popups/Popups";
import { getAcceptedCookies } from "../ts/cookies";
import { showModal } from "../ts/states/modals";
import { getHeaderBottom } from "../ts/states/page-layout";
import { RouterNavigation } from "./navigation.client";
import { preferencesReadiness } from "./readiness";

/**
 * Browser half of the common layout: overlays, global hotkeys, body classes
 * and the page scroller registration. Owned by the layout; removed with it.
 */
function ChromeRuntime(props: {
  fixed: boolean;
  scroller: HTMLElement | undefined;
  onHeaderBottom: (bottom: number) => void;
}): JSXElement {
  usePageScroller(
    () => props.scroller,
    () => props.fixed,
  );
  createEffect(() => props.onHeaderBottom(getHeaderBottom()));
  spread(
    document.body,
    {
      get class() {
        return bodyClass(document.body.className);
      },
    },
    false,
    true,
  );
  onMount(() => {
    let disposed = false;
    onCleanup(() => {
      disposed = true;
    });
    // Server configuration and authentication are independent startup requests.
    void ServerConfiguration.sync().catch((error: unknown) =>
      console.error("Failed to synchronize server configuration", error),
    );
    void preferencesReadiness()
      .wait()
      .then(() => {
        if (!disposed && getAcceptedCookies() === null) showModal("Cookies");
      })
      .catch(() => undefined);
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
      </Portal>
    </>
  );
}

/** Browser modules of the common layout, loaded together after hydration. */
export const chrome = { Header, Footer, Runtime: ChromeRuntime };
