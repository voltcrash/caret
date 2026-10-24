import { cleanup, fireEvent, render } from "@solidjs/testing-library";
import { afterEach, expect, it, vi } from "vite-plus/test";

import { CustomBackground } from "../../../src/ts/components/core/CustomBackground";
import {
  setBackground,
  setBackgroundSize,
  setBackgroundStyle,
} from "../../../src/ts/states/background";
import * as Notifications from "../../../src/ts/states/notifications";

afterEach(() => {
  cleanup();
  setBackground({ url: "" });
  Notifications.clearAllNotifications();
  vi.restoreAllMocks();
});

function reportImagePolicy(
  blockedURI: string,
  effectiveDirective = "img-src",
  disposition = "enforce",
): void {
  document.dispatchEvent(
    Object.assign(new Event("securitypolicyviolation"), {
      blockedURI,
      effectiveDirective,
      disposition,
    }),
  );
}

it("replaces an unavailable-image notice with a policy notice without duplicates", () => {
  const notice = vi.spyOn(Notifications, "showNoticeNotification");
  const remove = vi.spyOn(Notifications, "removeNotification");
  const view = render(() => <CustomBackground />);
  const url = "https://example.com/background.png";
  setBackground({ url });
  fireEvent.error(view.container.querySelector("img") as HTMLImageElement);
  const firstNotice = notice.mock.results[0]?.value;
  reportImagePolicy(url);
  expect(remove).toHaveBeenCalledWith(firstNotice);
  expect(notice).toHaveBeenLastCalledWith(
    "Your browser blocked this background image. Use a different image URL or upload a local image.",
    { durationMs: 5000 },
  );
  expect(Notifications.getNotifications()).toHaveLength(1);
  fireEvent.error(view.container.querySelector("img") as HTMLImageElement);
  expect(notice).toHaveBeenCalledTimes(2);
});

it("ignores unrelated/report-only policies and removes its policy listener on unmount", () => {
  const notice = vi.spyOn(Notifications, "showNoticeNotification");
  const view = render(() => <CustomBackground />);
  const url = "https://example.com/background.png";
  setBackground({ url });
  reportImagePolicy("https://example.com/other.png");
  reportImagePolicy(url, "connect-src");
  reportImagePolicy(url, "img-src", "report");
  expect(notice).not.toHaveBeenCalled();
  reportImagePolicy(url);
  expect(notice).toHaveBeenCalledOnce();
  view.unmount();
  reportImagePolicy(url);
  expect(notice).toHaveBeenCalledOnce();
});

it("replaces failed images on reapply and retains filter and size geometry", () => {
  const failed = vi.fn();
  window.addEventListener("customBackgroundFailed", failed);
  const { container } = render(() => <CustomBackground />);
  setBackgroundStyle({
    filter: "blur(2rem)",
    width: "calc(100% + 16rem)",
    top: "-8rem",
  });
  setBackgroundSize("contain");
  setBackground({ url: "https://example.com/background.png" });
  const image = container.querySelector("img");
  expect(image).toHaveStyle({
    "object-fit": "contain",
  });
  // Native computed styles normalize rem to px; check the authored geometry.
  expect(image?.style.filter).toBe("blur(2rem)");
  expect(image?.style.width).toBe("calc(100% + 16rem)");
  expect(image?.style.top).toBe("-8rem");
  fireEvent.error(image as HTMLImageElement);
  expect(image).toHaveClass("hidden");
  expect(failed).toHaveBeenCalledOnce();
  setBackground({ url: "https://example.com/background.png" });
  expect(container.querySelector("img")).not.toBe(image);
  expect(container.querySelector("img")).not.toHaveClass("hidden");
  setBackground({ url: "" });
  expect(container.querySelector("img")).toBeNull();
  window.removeEventListener("customBackgroundFailed", failed);
});

// Browser module exports are sealed; register spies before imports run.
vi.mock("../../../src/ts/states/notifications", { spy: true });
