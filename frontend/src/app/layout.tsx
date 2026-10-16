import { ClientOnly, useMatches, useRouter } from "@tanstack/solid-router";
import { createClientOnlyFn } from "@tanstack/solid-start";
import {
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

import {
  appClass,
  scrollerClass,
  scrollerStyle,
} from "../components/layout/scroller";
import { StaticHeader } from "../components/layout/static-header";
import { LinkHost, RouterLink } from "../components/link-host";
import { PageScrollHost } from "../components/page-scroll";
import { TypingRouteHost } from "../components/typing-route-host";

const load = createClientOnlyFn(
  async () => (await import("./chrome.client")).chrome,
);
const Header = lazy(async () => ({ default: (await load()).Header }));
const Footer = lazy(async () => ({ default: (await load()).Footer }));
const ChromeRuntime = lazy(async () => ({ default: (await load()).Runtime }));

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
  const staticHeader = () => <StaticHeader fixed={fixed()} />;
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
          <div id="app" class={appClass}>
            <ClientOnly fallback={staticHeader()}>
              <Suspense fallback={staticHeader()}>
                <Header fixed={fixed()} />
              </Suspense>
            </ClientOnly>
            <div
              ref={setScroller}
              data-scroll-restoration-id="page-content"
              class={scrollerClass(fixed())}
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
                <ClientOnly>
                  <Suspense>
                    <Footer />
                  </Suspense>
                </ClientOnly>
              </Show>
            </div>
          </div>
          <ClientOnly>
            <Suspense>
              <ChromeRuntime
                fixed={fixed()}
                scroller={scroller()}
                onHeaderBottom={setHeaderBottom}
              />
            </Suspense>
          </ClientOnly>
        </LinkHost.Provider>
      </TypingRouteHost.Provider>
    </PageScrollHost.Provider>
  );
}
