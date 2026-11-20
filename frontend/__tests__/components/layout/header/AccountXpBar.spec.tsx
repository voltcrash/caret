import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, expect, it, vi } from "vite-plus/test";

import { AccountXpBar } from "../../../../src/ts/components/layout/header/AccountXpBar";
import {
  setXpBarData,
  skipBreakdownEvent,
} from "../../../../src/ts/states/header";

afterEach(() => {
  cleanup();
  setXpBarData(null);
  vi.useRealTimers();
});

it("keeps a replacement breakdown skippable when the old animation settles", async () => {
  vi.useFakeTimers();
  const view = render(() => <AccountXpBar />);
  setXpBarData({ addedXp: 10, resultingXp: 10, breakdown: { base: 10 } });
  await vi.advanceTimersByTimeAsync(200);
  setXpBarData({
    addedXp: 80,
    resultingXp: 90,
    breakdown: { base: 20, fullAccuracy: 10, streak: 20, daily: 30 },
  });
  await vi.advanceTimersByTimeAsync(950);
  expect(view.getByText("+30")).toBeInTheDocument();
  skipBreakdownEvent.dispatch();
  expect(view.getByText("+80")).toBeInTheDocument();
});
