import { RouteDefinition } from "@solidjs/router";

import type { PageName } from "../pages/page";

export type AppRouteInfo = {
  page: PageName;
  access?: "guest" | "user";
  redirect?: string;
};

export const appRoutes = [
  { path: "/", info: { page: "test" } },
  { path: "/leaderboards", info: { page: "leaderboards" } },
  { path: "/about", info: { page: "about" } },
  { path: "/settings", info: { page: "settings" } },
  { path: "/login", info: { page: "login", access: "guest" } },
  { path: "/device", info: { page: "device" } },
  { path: "/account", info: { page: "account", access: "user" } },
  {
    path: "/account-settings",
    info: {
      page: "settings",
      access: "user",
      redirect: "/settings?tab=account",
    },
  },
  { path: "/profile", info: { page: "profileSearch" } },
  { path: "/profile/:uidOrName", info: { page: "profile" } },
  { path: "*notFound", info: { page: "404" } },
] satisfies (RouteDefinition & { info: AppRouteInfo })[];

/** Resolves the page a same-origin path renders, mirroring `appRoutes`. */
export function getPageForPath(pathname: string): PageName {
  const segments = pathname.split("/").filter((s) => s !== "");
  for (const route of appRoutes) {
    const pattern = route.path.split("/").filter((s) => s !== "");
    if (pattern[0]?.startsWith("*")) return route.info.page;
    if (pattern.length !== segments.length) continue;
    const matches = pattern.every(
      (part, i) => part.startsWith(":") || part === segments[i],
    );
    if (matches) return route.info.page;
  }
  return "404";
}
