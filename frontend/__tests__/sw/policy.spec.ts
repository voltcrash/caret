import { describe, expect, it } from "vite-plus/test";

import {
  activatesImmediately,
  buildCacheName,
  classify,
  obsoleteCaches,
  servesShell,
} from "../../src/sw/policy";

const origin = "https://oxytype.voltcrash.com";
function request(
  path: string,
  options: { method?: string; mode?: string; origin?: string } = {},
): { method: string; url: string; mode: string } {
  return {
    method: options.method ?? "GET",
    url: `${options.origin ?? origin}${path}`,
    mode: options.mode ?? "cors",
  };
}

describe("service-worker request policy", () => {
  it.each([
    ["/api/auth/get-session", {}],
    ["/api/users", {}],
    ["/api", {}],
    ["/_serverFn/abc?payload=%7B%7D", {}],
    ["/_serverFn/abc", { method: "POST" }],
    ["/assets/index-abc.js", { method: "HEAD" }],
    ["/sw.js", {}],
    ["/version.json", {}],
    ["/release.json", {}],
    ["/assets/index-abc.js", { origin: "https://cdn.example" }],
    ["/_api-docs/public.json", {}],
    ["/api/auth/callback/github", { mode: "navigate" }],
    ["/api/docs", { mode: "navigate" }],
    ["/unknown.txt", {}],
  ])("never caches %s %o", (path, options) => {
    expect(classify(request(path, options), origin)).toBe("bypass");
  });

  it.each(["/", "/settings", "/account", "/profile/someone?x=1", "/404.html"])(
    "handles document %s without caching it",
    (path) => {
      expect(classify(request(path, { mode: "navigate" }), origin)).toBe(
        "navigate",
      );
    },
  );

  it.each([
    "/assets/index-Cf0kvvmC.js",
    "/assets/app-Dk3s.css",
    "/languages/english.json?v=0123456789abcdef",
    "/js/oxytype.0a1b2c3d.js",
    "/css/vendor.0a1b2c3d.css",
    "/webfonts/RobotoMono-Regular.0a1b2c3d.woff2",
  ])("serves content-addressed %s cache-first", (path) => {
    expect(classify(request(path), origin)).toBe("immutable");
  });

  it.each([
    "/languages/english.json",
    "/themes/aether.css",
    "/webfonts/RobotoMono-Regular.woff2",
    "/layouts/qwerty.json",
    "/funbox/layoutfluid.json",
    "/challenges/list.json",
    "/sounds/click1/click1_1.wav",
    "/quotes/english.json",
    "/images/favicon/oxytype.svg",
    "/manifest.json",
  ])("revalidates public static %s", (path) => {
    expect(classify(request(path), origin)).toBe("static");
  });

  it("offers the guest shell only for the typing route", () => {
    expect(servesShell(`${origin}/`)).toBe(true);
    expect(servesShell(`${origin}/?testSettings=abc`)).toBe(true);
    expect(servesShell(`${origin}/settings`)).toBe(false);
    expect(servesShell(`${origin}/account`)).toBe(false);
  });
});

describe("service-worker cache generations", () => {
  const current = buildCacheName("b3");

  it("waits for legacy tabs and keeps their hashed assets one generation", () => {
    const names = [
      "workbox-precache-v2-https://oxytype.voltcrash.com/",
      "oxytype-build-assets",
      "oxytype-languages",
      "workbox-runtime-https://oxytype.voltcrash.com/",
      current,
    ];
    expect(activatesImmediately(true)).toBe(false);
    expect(obsoleteCaches(names, "b3")).toEqual([
      "workbox-precache-v2-https://oxytype.voltcrash.com/",
      "oxytype-languages",
      "workbox-runtime-https://oxytype.voltcrash.com/",
    ]);
  });

  it("waits behind another Start build and keeps only the previous build", () => {
    const names = [
      "oxytype-build-assets",
      buildCacheName("b1"),
      buildCacheName("b2"),
      current,
      "unrelated-cache",
    ];
    expect(activatesImmediately(true)).toBe(false);
    expect(obsoleteCaches(names, "b3")).toEqual([
      "oxytype-build-assets",
      buildCacheName("b1"),
    ]);
  });

  it("activates only on first installation, regardless of evicted caches", () => {
    expect(activatesImmediately(false)).toBe(true);
    expect(activatesImmediately(true)).toBe(false);
    expect(obsoleteCaches([current], "b3")).toEqual([]);
  });
});
