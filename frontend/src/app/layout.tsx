import { ClientOnly, useMatches } from "@tanstack/solid-router";
import { createClientOnlyFn } from "@tanstack/solid-start";
import {
  createSignal,
  lazy,
  Show,
  Suspense,
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
  const fixed = useMatches({
    select: (matches) =>
      matches.some((match) => match.staticData.fixedHeader === true),
  });
  const [scroller, setScroller] = createSignal<HTMLDivElement>();
  const [headerBottom, setHeaderBottom] = createSignal(0);
  const staticHeader = () => <StaticHeader fixed={fixed()} />;
  return (
    <LinkHost.Provider value={RouterLink}>
      <div id="app" class={appClass}>
        <ClientOnly fallback={staticHeader()}>
          <Suspense fallback={staticHeader()}>
            <Header fixed={fixed()} />
          </Suspense>
        </ClientOnly>
        <div
          ref={setScroller}
          class={scrollerClass(fixed())}
          style={scrollerStyle(fixed(), headerBottom())}
        >
          <main class="full-width content-grid h-full">{props.children}</main>
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
  );
}
