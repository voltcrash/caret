import { createRoot } from "solid-js";
import { expect, it, vi } from "vite-plus/test";
import { getBanners, removeBanner } from "../../src/ts/states/banners";
import {
  get,
  showOfflineBanner,
  useConnectionEvents,
} from "../../src/ts/states/connection";

it("keeps a dismissed banner hidden until reconnection", async () => {
  vi.useFakeTimers();
  const dispose = createRoot((dispose) => {
    useConnectionEvents();
    return dispose;
  });
  try {
    window.dispatchEvent(new Event("offline"));
    showOfflineBanner();
    const banner = getBanners().find(
      (item) => item.text === "No internet connection",
    );
    if (banner === undefined) throw new Error("Missing offline banner");
    removeBanner(banner.id);
    showOfflineBanner();
    expect(getBanners()).toHaveLength(0);
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(5000);
    window.dispatchEvent(new Event("offline"));
    expect(
      getBanners().filter((item) => item.text === "No internet connection"),
    ).toHaveLength(1);
  } finally {
    dispose();
    vi.useRealTimers();
  }
});

it("stops following the browser once disposed", () => {
  const dispose = createRoot((dispose) => {
    useConnectionEvents();
    return dispose;
  });
  window.dispatchEvent(new Event("offline"));
  expect(get()).toBe(false);
  dispose();
  window.dispatchEvent(new Event("online"));
  expect(get()).toBe(false);
});
