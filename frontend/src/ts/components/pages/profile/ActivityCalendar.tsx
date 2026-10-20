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

import { getSnapshot, getTestActivityCalendar } from "../../../db";
import { TestActivityCalendar } from "../../../elements/test-activity-calendar";
import { get as getSeverConfiguration } from "../../../states/server-configuration";
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
      labels: Array.from({ length: 7 }, (_, i) => {
        const weekday = (calendar.firstDayOfWeek + i) % 7;
        return weekday % 2 === 1 ? names[weekday] : undefined;
      }),
    });
  };

  createEffect(() => {
    const activity = props.isAccountPage
      ? getSnapshot()?.testActivity
      : props.testActivity;
    revision++;
    setSelectedYear("current");
    setError(undefined);
    updateCalendar(
      activity === undefined
        ? undefined
        : props.isAccountPage
          ? (activity as TestActivityCalendar)
          : new TestActivityCalendar(
              (activity as TestActivity).testsByDays,
              new Date((activity as TestActivity).lastDay),
              firstDayOfTheWeek,
            ),
      true,
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
      const calendar = await getTestActivityCalendar(year);
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
        "testActivity rounded-(--roundness) bg-sub-alt p-4 [--font-size:0.8em] [--gap-size:0.1em] lg:[--font-size:1em] lg:[--gap-size:0.15em] xl:[--gap-size:0.2em] 2xl:[--gap-size:0.25em]",
        !view().shown && "hidden",
      )}
    >
      <div
        class="wrapper mx-auto grid w-full max-w-[80em] gap-4"
        style={{ "--weeks": Math.max(1, Math.ceil(view().days.length / 7)) }}
      >
        <div class="top grid grid-cols-1 gap-4 [grid-template-areas:'title'_'legend'] has-[.year]:[grid-template-areas:'year'_'title'_'legend'] sm:grid-cols-[15rem_1fr_max-content] sm:[grid-template-areas:'title_title_legend'] sm:has-[.year]:[grid-template-areas:'year_title_legend']">
          <Show when={props.isAccountPage}>
            <div class="year text-(length:--font-size) [grid-area:year] [&_select]:border-[0.2em] [&_select]:border-solid [&_select]:border-bg">
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
          <div class="legend flex flex-wrap items-center justify-end gap-(--gap-size) self-center text-(length:--font-size) text-sub [grid-area:legend] [&_span:first-child]:mr-(--gap-size) [&_span:last-child]:ml-(--gap-size)">
            <span>less</span>
            <For each={["0", "1", "2", "3", "4"]}>
              {(level) => (
                <div
                  data-level={level}
                  class={cn(squareClass, "h-[1em] w-[1em]", levelClass(level))}
                ></div>
              )}
            </For>
            <span>more</span>
          </div>
        </div>
        <Show
          when={!view().noData}
          fallback={
            <div class="nodata text-sub">
              <Show when={error()} fallback="No data found.">
                <span role="alert" class="text-error">
                  {error()}
                </span>
              </Show>
            </div>
          }
        >
          <div class="calendarScroll overflow-x-auto sm:overflow-visible">
            <div class="grid min-w-[36rem] grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-3 sm:min-w-0">
              <div class="days col-start-1 row-start-1 grid grid-rows-[repeat(7,minmax(0,1fr))] items-center gap-(--gap-size) text-(length:--font-size) text-sub">
                <For each={view().labels}>
                  {(label) => (
                    <div class="flex h-0 items-center">
                      <Show when={label}>
                        {(text) => (
                          <>
                            <span class="hidden xl:inline">{text()}</span>
                            <span class="xl:hidden">
                              {text().substring(0, 3)}
                            </span>
                          </>
                        )}
                      </Show>
                    </div>
                  )}
                </For>
              </div>
              <div class="activity col-start-2 row-start-1 grid grid-flow-col grid-cols-[repeat(var(--weeks),minmax(0,1fr))] grid-rows-[repeat(7,minmax(0,1fr))] gap-(--gap-size)">
                <For each={view().days}>
                  {(day) => (
                    <div
                      class={cn(
                        squareClass,
                        "hover:border-2 hover:border-solid hover:border-text data-[level=filler]:hover:border-0",
                        levelClass(day.level),
                      )}
                      data-level={day.level}
                      aria-label={day.label}
                      data-balloon-pos={
                        day.label !== undefined ? "up" : undefined
                      }
                    ></div>
                  )}
                </For>
              </div>
              <div class="months col-start-2 row-start-2 grid grid-cols-[repeat(var(--weeks),minmax(0,1fr))] gap-(--gap-size) text-(length:--font-size) text-sub">
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
            </div>
          </div>
        </Show>
        <div class="note text-center text-[0.6em] text-sub">
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
