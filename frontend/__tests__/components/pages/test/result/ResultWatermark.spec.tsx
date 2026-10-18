import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { ResultWatermark } from "../../../../../src/features/typing/components/result/ResultWatermark";
import { setIsScreenshotting } from "../../../../../src/ts/states/core";
import { setScreenshotWatermark } from "../../../../../src/ts/states/result";

describe("ResultWatermark", () => {
  afterEach(() => {
    cleanup();
    setIsScreenshotting(false);
    setScreenshotWatermark(undefined);
  });

  it("only renders while screenshotting", () => {
    setScreenshotWatermark({ date: "01 Jan 2026 10:00", user: undefined });
    const { container } = render(() => <ResultWatermark />);
    expect(container.querySelector(".ssWatermark")).toBeNull();

    setIsScreenshotting(true);
    expect(
      [...container.querySelectorAll(".ssWatermark span")].map(
        (s) => s.textContent,
      ),
    ).toEqual(["01 Jan 2026 10:00", "|", "oxytype"]);
  });

  it("shows the user name and flag icons", () => {
    setScreenshotWatermark({
      date: "01 Jan 2026 10:00",
      user: { name: "bob", flags: { isPremium: true } },
    });
    setIsScreenshotting(true);
    const { container } = render(() => <ResultWatermark />);
    const [user] = container.querySelectorAll(".ssWatermark span");
    expect(user).toHaveTextContent("bob");
    expect(user?.querySelector("i")).toHaveClass("fas", "fa-dollar-sign");
    expect(container.querySelectorAll(".ssWatermark .pipe")).toHaveLength(2);
  });
});
