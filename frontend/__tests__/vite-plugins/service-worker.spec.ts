import { describe, expect, it } from "vite-plus/test";

import {
  offlineStaticFiles,
  precacheFromBundle,
} from "../../vite-plugins/service-worker";

type Output = Parameters<typeof precacheFromBundle>[0][string];

const root = "/repo/frontend";
function chunk(
  fileName: string,
  facade: string | null,
  options: {
    isEntry?: boolean;
    imports?: string[];
    dynamicImports?: string[];
    css?: string[];
  } = {},
): Output {
  return {
    type: "chunk" as const,
    fileName,
    isEntry: options.isEntry ?? false,
    facadeModuleId: facade === null ? null : `${root}/${facade}`,
    imports: options.imports ?? [],
    dynamicImports: options.dynamicImports ?? [],
    viteMetadata: { importedCss: new Set(options.css ?? []) },
  };
}

const bundle = {
  entry: chunk("assets/index.js", null, {
    isEntry: true,
    imports: ["assets/shared.js"],
    dynamicImports: [
      "assets/_app.js",
      "assets/_app.index.js",
      "assets/_app.settings.js",
    ],
  }),
  shared: chunk("assets/shared.js", null),
  layout: chunk("assets/_app.js", "src/routes/_app.tsx?tsr-split=component"),
  index: chunk(
    "assets/_app.index.js",
    "src/routes/_app.index.tsx?tsr-split=component",
    { dynamicImports: ["assets/page.client.js"] },
  ),
  settings: chunk(
    "assets/_app.settings.js",
    "src/routes/_app.settings.tsx?tsr-split=component",
    { imports: ["assets/settings-only.js"] },
  ),
  settingsOnly: chunk("assets/settings-only.js", null),
  page: chunk("assets/page.client.js", "src/features/typing/page.client.tsx", {
    imports: ["assets/typing-runtime.js"],
    dynamicImports: ["assets/unlisted-modal.js"],
    css: ["assets/page.css"],
  }),
  runtime: chunk("assets/typing-runtime.js", null),
  unlisted: chunk("assets/unlisted-modal.js", "src/ts/components/Unlisted.tsx"),
  css: { type: "asset" as const, fileName: "assets/app.css" },
  image: { type: "asset" as const, fileName: "assets/logo.svg" },
};

describe("service-worker precache", () => {
  it("covers the entry, typing route, declared typing modules and their imports", () => {
    expect(
      precacheFromBundle(bundle, ["src/features/typing/page.client.tsx"]),
    ).toEqual([
      "/assets/_app.index.js",
      "/assets/_app.js",
      "/assets/app.css",
      "/assets/index.js",
      "/assets/page.client.js",
      "/assets/page.css",
      "/assets/shared.js",
      "/assets/typing-runtime.js",
    ]);
  });

  it("fails the build when a declared offline module is no longer a chunk", () => {
    expect(() =>
      precacheFromBundle(bundle, [
        "src/features/typing/page.client.tsx",
        "src/features/typing/renamed.client.tsx",
      ]),
    ).toThrow(/renamed\.client\.tsx/);
  });

  it("adds the default language, fonts and manifest", () => {
    expect(offlineStaticFiles("0123456789abcdef0123")).toEqual([
      "/languages/english.json?v=0123456789abcdef",
      "/webfonts/RobotoMono-Regular.woff2",
      "/webfonts/LexendDeca-Regular.woff2",
      "/manifest.json",
      "/images/favicon/oxytype.svg",
    ]);
  });
});
