import type { TestActivity } from "@oxytype/schemas/users";

import { cleanup, render } from "@solidjs/testing-library";
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
vi.mock("../../../../src/ts/states/server-configuration", () => ({
  get: () => undefined,
}));
vi.mock("../../../../src/ts/utils/date-and-time", async (original) => ({
  ...(await original<
    typeof import("../../../../src/ts/utils/date-and-time")
  >()),
  getFirstDayOfTheWeek: () => 1,
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
  expect(
    [...container.querySelectorAll(".days > div > span:first-child")].map(
      (label) => label.textContent,
    ),
  ).toEqual(["monday", "wednesday", "friday"]);
  setData(undefined);
  expect(container.querySelector(".testActivity")).toHaveClass("hidden");
  expect(container.querySelector(".activity")?.children).toHaveLength(0);
});
