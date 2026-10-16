import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { ResultLoginTip } from "../../../../../src/features/typing/components/result/ResultLoginTip";
import { setIsScreenshotting } from "../../../../../src/ts/states/core";
import { setResultState } from "../../../../../src/ts/states/result";

describe("ResultLoginTip", () => {
  afterEach(() => {
    cleanup();
    setIsScreenshotting(false);
    setResultState("loginTip", false);
  });

  it("follows the store and hides while screenshotting", () => {
    const { container } = render(() => <ResultLoginTip />);
    const tip = container.querySelector(".loginTip");
    expect(tip).toHaveClass("hidden");

    setResultState("loginTip", true);
    expect(tip).not.toHaveClass("hidden");
    expect(tip?.querySelector("a[router-link]")).toHaveAttribute(
      "href",
      "/login",
    );

    setIsScreenshotting(true);
    expect(tip).toHaveClass("hidden");
  });
});
