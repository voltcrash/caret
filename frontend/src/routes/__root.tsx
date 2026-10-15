import type { QueryClient } from "@tanstack/solid-query";
import type { JSX } from "solid-js";

import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  Link,
} from "@tanstack/solid-router";
import { HydrationScript } from "solid-js/web";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: "Oxytype" },
      ],
    }),
    shellComponent: Root,
    notFoundComponent: () => (
      <main>
        <h1>Page not found</h1>
        <Link to="/about">About Oxytype</Link>
      </main>
    ),
    errorComponent: () => (
      <main role="alert">
        <h1>Unable to load Oxytype</h1>
        <a href="/about">Try again</a>
      </main>
    ),
  },
);

function Root(props: { children: JSX.Element }) {
  return (
    <html lang="en">
      <head>
        <HydrationScript />
      </head>
      <body>
        <HeadContent />
        {props.children}
        <Scripts />
      </body>
    </html>
  );
}
