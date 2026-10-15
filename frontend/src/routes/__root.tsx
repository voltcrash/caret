import type { QueryClient } from "@tanstack/solid-query";

import {
  Outlet,
  createRootRouteWithContext,
  redirect,
} from "@tanstack/solid-router";

import { canonicalHref } from "../app/aliases";
import appCss from "../app/app.css?url";
import { BrowserRuntime } from "../app/browser-runtime";
import { Document } from "../app/document";
import { AppLayout } from "../app/layout";
import { AppProviders } from "../app/providers";
import { AppError } from "../components/app-error";
import { NotFoundPage } from "../features/not-found/page";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    beforeLoad: ({ location }) => {
      const href = canonicalHref(location);
      if (href !== undefined) {
        // oxlint-disable-next-line typescript/only-throw-error -- Router consumes this redirect.
        throw redirect({ href, statusCode: 301 });
      }
    },
    head: ({ matches }) => ({
      meta: [
        { charset: "utf-8" },
        {
          name: "viewport",
          content:
            "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content",
        },
        {
          title: matches.some(
            (match) => match.status === "notFound" || match._notFound === true,
          )
            ? "404 | Oxytype"
            : "Oxytype",
        },
        {
          name: "description",
          content: "A minimalistic, customizable typing test.",
        },
        { name: "format-detection", content: "telephone=no" },
        { name: "theme-color", content: "#323437" },
        { name: "author", content: "Oxytype contributors" },
        { name: "mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-title", content: "Oxytype" },
        {
          name: "apple-mobile-web-app-status-bar-style",
          content: "black-translucent",
        },
        { name: "twitter:card", content: "summary" },
        { property: "og:type", content: "website" },
        { name: "darkreader-lock", content: "" },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        {
          rel: "icon",
          type: "image/svg+xml",
          href: "/images/favicon/oxytype.svg",
        },
        {
          rel: "apple-touch-icon",
          sizes: "180x180",
          href: "/images/icons/oxytype-180.png",
        },
        { rel: "manifest", href: "/manifest.start.webmanifest" },
        ...["RobotoMono-Regular", "LexendDeca-Regular"].map((font) => ({
          rel: "preload",
          href: `/webfonts/${font}.woff2`,
          as: "font" as const,
          type: "font/woff2",
          crossorigin: "anonymous" as const,
        })),
      ],
    }),
    shellComponent: Document,
    component: Root,
    notFoundComponent: () => (
      <AppLayout>
        <NotFoundPage />
      </AppLayout>
    ),
    errorComponent: AppError,
  },
);

function Root() {
  const context = Route.useRouteContext();
  return (
    <AppProviders queryClient={context().queryClient}>
      <BrowserRuntime />
      <Outlet />
    </AppProviders>
  );
}
