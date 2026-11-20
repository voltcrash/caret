import { render, waitFor } from "@solidjs/testing-library";
import { Chart } from "chart.js";
import { expect, it, vi } from "vite-plus/test";

import { AccountContent } from "../../../src/features/account/components/AccountContent";
import { mockOperation, ok } from "../../__harness__/operations";

vi.mock("../../../src/ts/states/core", async (original) => ({
  ...(await original<typeof import("../../../src/ts/states/core")>()),
  isAuthenticated: () => true,
  getUserId: () => "history-user",
}));
vi.mock("../../../src/data/collections/tags", async (original) => ({
  ...(await original<typeof import("../../../src/data/collections/tags")>()),
  getTagsOnce: async () => [],
  useTagsLiveQuery: () => () => [],
}));
vi.mock("../../../src/features/account/components/Filters", () => ({
  Filters: () => null,
}));
vi.mock("../../../src/features/account/components/TestStats", () => ({
  TestStats: () => null,
}));
vi.mock("../../../src/features/account/components/MyProfile", () => ({
  MyProfile: () => null,
}));

it("reveals the eleventh result and follows its identity after a table sort", async () => {
  const rows = Array.from({ length: 24 }, (_, index) => ({
    _id: String(index),
    uid: "history-user",
    timestamp: Date.now() - index * 1000,
    mode: "time",
    mode2: "15",
    testDuration: 15,
    wpm: 50 + index,
    rawWpm: 50 + index,
    charStats: [80, 0, 0, 0],
    acc: 95,
    consistency: 80,
    keyConsistency: 80,
  }));
  mockOperation("results.get", () => ok(rows));
  const view = render(() => <AccountContent client="web" />);
  const canvas = await view.findByRole("img", { name: "History chart" });
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("Missing history canvas");
  }
  const selected = (): Element | null =>
    view.container.querySelector('#resultList tbody tr[data-state="selected"]');
  const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
  const clickPoint = (index: number): void => {
    const point = Chart.getChart(canvas)?.getDatasetMeta(0).data[index];
    if (point === undefined) throw new Error("Missing speed point");
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        clientX: rect.left + point.x,
        clientY: rect.top + point.y,
      }),
    );
  };
  try {
    await waitFor(() =>
      expect(
        view.container.querySelectorAll("#resultList tbody tr"),
      ).toHaveLength(10),
    );
    clickPoint(10);
    await waitFor(() => expect(selected()?.textContent).toContain("60"));
    await waitFor(() => expect(scroll.mock.contexts.at(-1)).toBe(selected()));
    const speed = view.getByRole("button", { name: /^wpm$/i });
    speed.click();
    // Descending WPM puts the newest (slowest) result on page three.
    await waitFor(() =>
      expect(speed.closest("th")).toHaveAttribute("aria-sort", "descending"),
    );
    clickPoint(0);
    await waitFor(() => expect(selected()?.textContent).toContain("50"));
    await waitFor(() => expect(scroll.mock.contexts.at(-1)).toBe(selected()));
  } finally {
    scroll.mockRestore();
  }
});
