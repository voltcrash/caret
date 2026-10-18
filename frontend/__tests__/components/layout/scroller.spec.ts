import { expect, it } from "vite-plus/test";

import {
  appRevealClass,
  appStyle,
} from "../../../src/components/layout/scroller";

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

it("hides the app under the startup screen, then fades it in", () => {
  expect(appRevealClass(false)).toBe("opacity-0");
  expect(appRevealClass(true)).toBe("animate-app-enter");
});
