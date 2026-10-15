import { Client } from "@oxytype/schemas/shared";
import { TestActivity } from "@oxytype/schemas/users";
import {
  createEffect,
  createSignal,
  For,
  JSXElement,
  onCleanup,
  Show,
} from "solid-js";

import { get as getSeverConfiguration } from "../../../ape/server-configuration";
import { getSnapshot, getTestActivityCalendar } from "../../../db";
import { TestActivityCalendar } from "../../../elements/test-activity-calendar";
import { getQueryClient } from "../../../queries";
import { getAccountActivityQueryOptions } from "../../../queries/account";
import { cn } from "../../../utils/cn";
import { getFirstDayOfTheWeek } from "../../../utils/date-and-time";
import { createErrorMessage } from "../../../utils/error";
import Select, { SelectProps } from "../../ui/Select";

const firstDayOfTheWeek = getFirstDayOfTheWeek();

export function ActivityCalendar(props: {
  isAccountPage?: true;
  testActivity?: TestActivity;
  client?: Client;
}): JSXElement {
  const [selectedYear, setSelectedYear] = createSignal("current");
  const [error, setError] = createSignal<string>();
  let revision = 0;
  onCleanup(() => revision++);
  const [view, setView] = createSignal({
    shown: false,
    noData: false,
    title: "",
    days: [] as ReturnType<TestActivityCalendar["getDays"]>,
    months: [] as ReturnType<TestActivityCalendar["getMonths"]>,
    labels: [] as (string | undefined)[],
  });
  const updateCalendar = (
    calendar: TestActivityCalendar | undefined,
    initial = false,
  ): void => {
    if (calendar === undefined) {
      setView((prev) => ({
        ...prev,
        shown: !initial,
        noData: !initial,
        days: [],
        months: [],
      }));
      return;
    }
    const names = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    setView({
      shown: true,
      noData: false,
      title: `${calendar.getTotalTests()} tests${props.isAccountPage ? "" : " last 12 months"}`,
      days: calendar.getDays(),
      months: calendar.getMonths(),
      labels: Array.from({ length: 7 }, (_, i) =>
        i % 2 !== calendar.firstDayOfWeek % 2
          ? names[(calendar.firstDayOfWeek + i) % 7]
          : undefined,
      ),
    });
  };

  createEffect(() => {
    const activity =
      props.isAccountPage && props.client !== "tui"
        ? getSnapshot()?.testActivity
        : props.testActivity;
    revision++;
    setSelectedYear("current");
    setError(undefined);
    updateCalendar(
      activity === undefined
        ? undefined
        : props.isAccountPage && props.client !== "tui"
          ? (activity as TestActivityCalendar)
          : new TestActivityCalendar(
              (activity as TestActivity).testsByDays,
              new Date((activity as TestActivity).lastDay),
              firstDayOfTheWeek,
            ),
      props.client !== "tui",
    );
  });

  const yearOptions = () => {
    const startYear =
      getSnapshot()?.addedAt !== undefined
        ? new Date(getSnapshot()?.addedAt ?? 0).getFullYear()
        : 2020;
    const currentYear = new Date().getFullYear();
    const years: SelectProps["options"] = [
      {
        text: "last 12 months",
        value: "current",
      },
    ];
    for (let year = currentYear; year >= startYear; year--) {
      if (
        years.length < 2 ||
        (getSeverConfiguration()?.users.premium.enabled &&
          getSnapshot()?.isPremium)
      ) {
        years.push({
          text: year.toString(),
          value: year.toString(),
        });
      }
    }
    return years;
  };

  const selectYear = async (year: string): Promise<void> => {
    const current = ++revision;
    setError(undefined);
    try {
      let calendar: TestActivityCalendar | undefined;
      if (props.client !== "tui") {
        calendar = await getTestActivityCalendar(year);
      } else if (year === "current") {
        const activity = props.testActivity;
        if (activity !== undefined) {
          calendar = new TestActivityCalendar(
            activity.testsByDays,
            new Date(activity.lastDay),
            firstDayOfTheWeek,
          );
        }
      } else {
        const activity = await getQueryClient().query(
          getAccountActivityQueryOptions("tui"),
        );
        const days = activity?.[year];
        if (days !== undefined && days.length > 0) {
          calendar = new TestActivityCalendar(
            days,
            new Date(Date.UTC(Number(year), 0, days.length)),
            firstDayOfTheWeek,
            true,
          );
        }
      }
      if (current === revision) updateCalendar(calendar);
    } catch (err) {
      if (current === revision) {
        updateCalendar(undefined);
        setError(createErrorMessage(err, "Could not load activity"));
      }
    }
  };

  return (
    <div
      class={cn(
        "testActivity flex overflow-x-auto rounded-(--roundness) bg-sub-alt p-4 sm:justify-center [--font-size:1em] [--gap-size:0.25em] max-[calc(1024px+5rem)]:[--font-size:0.8em] max-[calc(1024px+5rem)]:[--gap-size:0.1em] [@media(width<=calc(1280px+5rem))_and_(width>calc(1024px+5rem))]:[--gap-size:0.15em] [@media(width<=calc(1536px+5rem))_and_(width>calc(1280px+5rem))]:[--gap-size:0.2em]",
        !view().shown && "hidden",
      )}
    >
      <div class="wrapper grid w-full max-w-[80em] grid-cols-[min-content_1fr] grid-rows-[min-content_1fr_min-content] gap-[1em] [grid-template-areas:'top_top'_'day_chart'_'empty_month'] max-[calc(1024px+5rem)]:[grid-template-areas:'top_top'_'chart_chart'_'month_month']">
        <div class="top grid grid-cols-1 gap-4 [grid-area:top] [grid-template-areas:'title'_'legend'] has-[.year]:[grid-template-areas:'year'_'title'_'legend'] sm:grid-cols-[15rem_1fr_max-content] sm:[grid-template-areas:'title_title_legend'] sm:has-[.year]:[grid-template-areas:'year_title_legend']">
          <Show when={props.isAccountPage}>
            <div class="year text-(length:--font-size) [grid-area:year] [&_select]:border-[0.2em] [&_select]:border-bg">
              <Select
                label="Year"
                options={yearOptions()}
                selected={selectedYear()}
                settings={{ showSearch: false }}
                onChange={(value) => {
                  setSelectedYear(value ?? "current");
                  void selectYear(value ?? "current");
                }}
              />
            </div>
          </Show>
          <div class="title self-center text-left text-(length:--font-size) text-sub [grid-area:title]">
            {view().title}
          </div>
          <div class="legend flex flex-wrap items-center justify-end gap-(--gap-size) self-center text-sub [grid-area:legend] [&_span]:text-(length:--font-size) [&_span:first-child]:mr-(--gap-size) [&_span:last-child]:ml-(--gap-size)">
            <span>less</span>
            <div
              data-level="0"
              class={cn(squareClass, "h-[1em] w-[1em]", levelClass("0"))}
            ></div>
            <div
              data-level="1"
              class={cn(squareClass, "h-[1em] w-[1em]", levelClass("1"))}
            ></div>
            <div
              data-level="2"
              class={cn(squareClass, "h-[1em] w-[1em]", levelClass("2"))}
            ></div>
            <div
              data-level="3"
              class={cn(squareClass, "h-[1em] w-[1em]", levelClass("3"))}
            ></div>
            <div
              data-level="4"
              class={cn(squareClass, "h-[1em] w-[1em]", levelClass("4"))}
            ></div>
            <span>more</span>
          </div>
        </div>
        <div class="activity grid min-w-[36rem] grid-flow-col grid-cols-[repeat(53,1fr)] grid-rows-[repeat(7,1fr)] gap-(--gap-size) [grid-area:chart] sm:min-w-0">
          <For each={view().days}>
            {(day) => (
              <div
                class={cn(
                  squareClass,
                  "hover:border-2 hover:border-text data-[level=filler]:hover:border-0",
                  levelClass(day.level),
                )}
                data-level={day.level}
                aria-label={day.label}
                data-balloon-pos={day.label !== undefined ? "up" : undefined}
              ></div>
            )}
          </For>
        </div>
        <div class="months grid grid-cols-[repeat(53,1fr)] text-(length:--font-size) text-sub [grid-area:month]">
          <For each={view().months}>
            {(month) => (
              <div
                class="w-full text-center"
                style={{ "grid-column": `span ${month.weeks}` }}
              >
                {month.text}
              </div>
            )}
          </For>
        </div>
        <div class="daysFull mr-8 grid grid-rows-[repeat(7,1fr)] items-center text-sub [grid-area:day] max-[calc(1280px+5rem)]:hidden max-[calc(1536px+5rem)]:mr-4">
          <For each={view().labels}>
            {(label) => (
              <div>
                <Show when={label}>
                  {(text) => (
                    <div class="text flex h-0 items-center text-(length:--font-size)">
                      {text()}
                    </div>
                  )}
                </Show>
              </div>
            )}
          </For>
        </div>
        <div class="days hidden grid-rows-[repeat(7,1fr)] items-center text-sub [grid-area:day] [@media(width<=calc(1280px+5rem))_and_(width>calc(1024px+5rem))]:grid">
          <For each={view().labels}>
            {(label) => (
              <div>
                <Show when={label}>
                  {(text) => (
                    <div class="text flex h-0 items-center text-(length:--font-size)">
                      {text().substring(0, 3)}
                    </div>
                  )}
                </Show>
              </div>
            )}
          </For>
        </div>
        <div class={cn("nodata [grid-area:chart]", !view().noData && "hidden")}>
          <Show when={error()} fallback="No data found.">
            <span role="alert" class="text-error">
              {error()}
            </span>
          </Show>
        </div>
        <div class="note col-span-2 text-center text-[0.6em] text-sub">
          Note: All activity data is using UTC time.
        </div>
      </div>
    </div>
  );
}

const squareClass =
  "aspect-square w-full place-self-center rounded-(--gap-size)";
function levelClass(level: string): string {
  return (
    (
      {
        "0": "bg-bg",
        "1": "bg-main/20",
        "2": "bg-main/50",
        "3": "bg-main/75",
        "4": "bg-main",
      } as Record<string, string>
    )[level] ?? ""
  );
}
