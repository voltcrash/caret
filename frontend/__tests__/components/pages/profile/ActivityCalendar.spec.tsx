import type { Client } from "@oxytype/schemas/shared";
import type { TestActivity } from "@oxytype/schemas/users";

import { cleanup, render, waitFor } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, expect, it, vi } from "vite-plus/test";
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  webCalendar: vi.fn(),
  selectYear: undefined as ((value: string | undefined) => void) | undefined,
}));
vi.mock("../../../../src/ts/db", () => ({
  getSnapshot: () => undefined,
  getTestActivityCalendar: mocks.webCalendar,
}));
vi.mock("../../../../src/ts/queries", () => ({
  getQueryClient: () => ({ query: mocks.query }),
}));
vi.mock("../../../../src/ts/queries/account", () => ({
  getAccountActivityQueryOptions: (client: Client) => ({ client }),
}));
vi.mock("../../../../src/ts/ape/server-configuration", () => ({
  get: () => undefined,
}));
vi.mock("../../../../src/ts/components/ui/Select", () => ({
  default: (props: { onChange: NonNullable<typeof mocks.selectYear> }) => {
    mocks.selectYear = props.onChange;
    return null;
  },
}));
import { ActivityCalendar } from "../../../../src/ts/components/pages/profile/ActivityCalendar";
import { TestActivityCalendar } from "../../../../src/ts/elements/test-activity-calendar";
import { getFirstDayOfTheWeek } from "../../../../src/ts/utils/date-and-time";
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.selectYear = undefined;
});

it("renders the calendar's day levels, labels, month spans and total, and clears absent activity", () => {
  const activity = {
    testsByDays: [1, 2, 4],
    lastDay: Date.now(),
  } as TestActivity;
  const expected = new TestActivityCalendar(
    activity.testsByDays,
    new Date(activity.lastDay),
    getFirstDayOfTheWeek(),
  );
  const [data, setData] = createSignal<TestActivity | undefined>(activity);
  const { container } = render(() => (
    <ActivityCalendar testActivity={data()} />
  ));
  expect(container.querySelector(".title")?.textContent).toBe(
    `${expected.getTotalTests()} tests last 12 months`,
  );
  const cells = [...container.querySelectorAll(".activity > div")];
  expect(
    cells.map((cell) => ({
      level: cell.getAttribute("data-level"),
      label: cell.getAttribute("aria-label") ?? undefined,
    })),
  ).toEqual(expected.getDays());
  expect(
    [...container.querySelectorAll<HTMLElement>(".months > div")].map(
      (cell) => ({
        text: cell.textContent,
        weeks: Number(cell.style.gridColumn.replace("span ", "")),
      }),
    ),
  ).toEqual(expected.getMonths());
  setData(undefined);
  expect(container.querySelector(".testActivity")).toHaveClass("hidden");
  expect(container.querySelector(".activity")?.children).toHaveLength(0);
});

it("loads terminal year archives independently and restores current activity", async () => {
  const activity = {
    testsByDays: [2, 3],
    lastDay: Date.UTC(2026, 9, 8),
  } as TestActivity;
  mocks.query.mockResolvedValueOnce({ "2024": [4, 5] });
  const { container } = render(() => (
    <ActivityCalendar isAccountPage client="tui" testActivity={activity} />
  ));
  expect(container.querySelector(".title")?.textContent).toBe("5 tests");
  mocks.selectYear?.("2024");
  expect(mocks.query).toHaveBeenCalledWith({ client: "tui" });
  expect(mocks.webCalendar).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(container.querySelector(".title")?.textContent).toBe("9 tests"),
  );
  expect(
    container.querySelector(
      '.activity [aria-label="4 tests on Monday 01 Jan 2024"]',
    ),
  ).not.toBeNull();
  mocks.selectYear?.("current");
  expect(container.querySelector(".title")?.textContent).toBe("5 tests");
  expect(mocks.query).toHaveBeenCalledTimes(1);
});

it("shows empty terminal activity and archive failures", async () => {
  const { container, getByRole } = render(() => (
    <ActivityCalendar isAccountPage client="tui" />
  ));
  expect(container.querySelector(".testActivity")).not.toHaveClass("hidden");
  expect(container.querySelector(".nodata")).not.toHaveClass("hidden");
  mocks.query.mockRejectedValueOnce(new Error("Archive unavailable"));
  mocks.selectYear?.("2024");
  await waitFor(() =>
    expect(getByRole("alert")).toHaveTextContent("Archive unavailable"),
  );
  expect(container.querySelector(".activity")?.children).toHaveLength(0);
});

it("ignores a terminal archive response after switching back to web", async () => {
  const activity = {
    testsByDays: [7],
    lastDay: Date.UTC(2026, 9, 8),
  } as TestActivity;
  let resolveArchive: ((value: Record<string, number[]>) => void) | undefined;
  mocks.query.mockImplementationOnce(
    async () =>
      new Promise<Record<string, number[]>>((resolve) => {
        resolveArchive = resolve;
      }),
  );
  const [client, setClient] = createSignal<Client>("tui");
  const { container } = render(() => (
    <ActivityCalendar isAccountPage client={client()} testActivity={activity} />
  ));
  mocks.selectYear?.("2024");
  setClient("web");
  resolveArchive?.({ "2024": [99] });
  await Promise.resolve();
  expect(container.querySelector(".testActivity")).toHaveClass("hidden");
  expect(container.querySelector(".activity")?.children).toHaveLength(0);
});
