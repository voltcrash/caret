import { expect, it } from "vite-plus/test";

import { appClass, appStyle } from "../../../src/components/layout/scroller";

it("keeps the document grid untouched without banners or the skill-issue screen", () => {
  expect(appStyle(0, false)).toBeUndefined();
});

it("pads the app below banners and hides it for the skill-issue screen", () => {
  expect(appStyle(48, false)).toEqual({
    display: undefined,
    "padding-top": "calc(48px + 2rem)",
  });
  expect(appStyle(0, true)).toEqual({
    display: "none",
    "padding-top": undefined,
  });
});

it("fades the app in on initial load", () => {
  expect(appClass.split(" ")).toContain("animate-app-enter");
});
