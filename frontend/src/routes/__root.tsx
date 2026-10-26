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
import { publicEnv } from "../app/public-env";
import { AppError } from "../components/app-error";
import { NotFoundPage } from "../features/not-found/page";

const socialImage = `${publicEnv.origin}/images/og/caret.png`;

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
        { name: "theme-color", content: "#0b0d1c" },
        { name: "author", content: "Oxytype contributors" },
        { name: "mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-title", content: "Oxytype" },
        {
          name: "apple-mobile-web-app-status-bar-style",
          content: "black-translucent",
        },
        { name: "twitter:card", content: "summary_large_image" },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "Oxytype" },
        { property: "og:image", content: socialImage },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:alt", content: "Oxytype logo" },
        { name: "twitter:image", content: socialImage },
        { name: "darkreader-lock", content: "" },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        {
          rel: "icon",
          type: "image/svg+xml",
          href: "/images/favicon/caret.svg",
        },
        {
          rel: "apple-touch-icon",
          sizes: "180x180",
          href: "/images/icons/caret-180.png",
        },
        { rel: "manifest", href: "/manifest.json" },
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
