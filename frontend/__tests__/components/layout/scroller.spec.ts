import { expect, it } from "vite-plus/test";

import { appStyle } from "../../../src/components/layout/scroller";

it("keeps the document grid untouched without the skill-issue screen", () => {
  expect(appStyle(false)).toBeUndefined();
});

it("hides the app for the skill-issue screen", () => {
  expect(appStyle(true)).toEqual({
    display: "none",
  });
});
