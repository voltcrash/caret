import { ClientOnly, useMatches, useRouter } from "@tanstack/solid-router";
import { createClientOnlyFn } from "@tanstack/solid-start";
import {
  createEffect,
  createSignal,
  lazy,
  onCleanup,
  onMount,
  Show,
  Suspense,
  untrack,
  type JSXElement,
  type ParentProps,
} from "solid-js";
import { isServer } from "solid-js/web";

import {
  appClass,
  appStyle,
  scrollerClass,
  scrollerStyle,
} from "../components/layout/scroller";
import { StaticFooter } from "../components/layout/static-footer";
import { StaticHeader } from "../components/layout/static-header";
import { LinkHost, RouterLink } from "../components/link-host";
import { PageScrollHost } from "../components/page-scroll";
import { TypingRouteHost } from "../components/typing-route-host";
import {
  createStartupReveal,
  isStartupFinished,
  setStartupFinished,
} from "./startup";

const load = createClientOnlyFn(
  async () => (await import("./critical-chrome.client")).chrome,
);
const Header = lazy(async () => ({ default: (await load()).Header }));
const Footer = lazy(async () => ({ default: (await load()).Footer }));
const ChromeRuntime = lazy(async () => ({
  default: (await import("./chrome.client")).chrome.Runtime,
}));

declare module "@tanstack/solid-router" {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- Router static data uses declaration merging.
  interface StaticDataRouteOption {
    /** Long pages with a sticky sidebar: header stays, content scrolls. */
    fixedHeader?: boolean;
  }
}

/**
 * Common application layout. The document, header geometry, page content and
 * links render on the server; stateful chrome and overlays mount as client leaves.
 */
export function AppLayout(props: ParentProps): JSXElement {
  const router = useRouter();
  const [main, setMain] = createSignal<HTMLElement>();
  onMount(() => {
    onCleanup(
      router.subscribe("onResolved", (event) => {
        if (event.pathChanged && event.toLocation.hash === "") {
          untrack(main)?.focus({ preventScroll: true });
        }
      }),
    );
  });
  const typing = useMatches({
    select: (matches) => matches.some((match) => match.routeId === "/_app/"),
  });
  const fixed = useMatches({
    select: (matches) =>
      matches.some((match) => match.staticData.fixedHeader === true),
  });
  const [scroller, setScroller] = createSignal<HTMLDivElement>();
  const [headerBottom, setHeaderBottom] = createSignal(0);
  const [offsetTop, setOffsetTop] = createSignal(0);
  const [hidden, setHidden] = createSignal(false);
  const staticHeader = () => <StaticHeader fixed={fixed()} />;
  // Readiness schedules background work; server-rendered content is always visible.
  const ready = createStartupReveal(typing);
  const finished = () => !isServer && isStartupFinished();
  createEffect(() => {
    if (ready()) setStartupFinished(true);
  });
  return (
    <PageScrollHost.Provider
      value={(position) => {
        untrack(scroller)?.scrollTo({
          left: position.scrollX,
          top: position.scrollY,
          behavior: "instant",
        });
      }}
    >
      <TypingRouteHost.Provider value={typing}>
        <LinkHost.Provider value={RouterLink}>
          <div
            id="app"
            class={appClass}
            style={appStyle(offsetTop(), hidden())}
          >
            <ClientOnly fallback={staticHeader()}>
              <Suspense fallback={staticHeader()}>
                <Header fixed={fixed()} />
              </Suspense>
            </ClientOnly>
            <div
              ref={setScroller}
              data-scroll-restoration-id="page-content"
              class={scrollerClass(fixed(), typing())}
              style={scrollerStyle(fixed(), headerBottom())}
            >
              <main
                ref={setMain}
                tabIndex={-1}
                class="full-width content-grid h-full outline-none"
              >
                {props.children}
              </main>
              <Show when={!fixed()}>
                <ClientOnly fallback={<StaticFooter />}>
                  <Suspense fallback={<StaticFooter />}>
                    <Footer />
                  </Suspense>
                </ClientOnly>
              </Show>
            </div>
          </div>
          <Show when={finished()}>
            <ClientOnly>
              <Suspense>
                <ChromeRuntime
                  fixed={fixed()}
                  scroller={scroller()}
                  onHeaderBottom={setHeaderBottom}
                  onOffsetTop={setOffsetTop}
                  onHidden={setHidden}
                />
              </Suspense>
            </ClientOnly>
          </Show>
        </LinkHost.Provider>
      </TypingRouteHost.Provider>
    </PageScrollHost.Provider>
  );
}
