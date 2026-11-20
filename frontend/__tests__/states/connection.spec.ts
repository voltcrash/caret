import { createRoot } from "solid-js";
import { expect, it, vi } from "vite-plus/test";
import { connectionEvent } from "../../src/ts/events/connection";
import { getBanners, removeBanner } from "../../src/ts/states/banners";
import {
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
    connectionEvent.dispatch(false);
    showOfflineBanner();
    const banner = getBanners().find(
      (item) => item.text === "No internet connection",
    );
    if (banner === undefined) throw new Error("Missing offline banner");
    removeBanner(banner.id);
    showOfflineBanner();
    expect(getBanners()).toHaveLength(0);
    connectionEvent.dispatch(true);
    await vi.advanceTimersByTimeAsync(5000);
    connectionEvent.dispatch(false);
    expect(
      getBanners().filter((item) => item.text === "No internet connection"),
    ).toHaveLength(1);
  } finally {
    dispose();
    vi.useRealTimers();
  }
});
