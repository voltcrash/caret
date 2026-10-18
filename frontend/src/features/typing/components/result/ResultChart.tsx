import type {
  CartesianScaleOptions,
  ChartData,
  ChartOptions,
  TooltipItem,
} from "chart.js";

import { getWordIndexesForSecond } from "@oxytype/typing-core/events/stats";
import { typedKeys } from "@oxytype/util/objects";
import { For, JSXElement, onCleanup, Show } from "solid-js";

import { ChartJs } from "../../../../ts/components/common/ChartJs";
import { Fa } from "../../../../ts/components/common/Fa";
import { Theme } from "../../../../ts/constants/themes";
import { createDebouncedEffectOn } from "../../../../ts/hooks/effects";
import {
  getResultChart,
  getResultChartDataset,
  resultState,
  setResultChart,
  type ResultChartLegendId,
  type ResultChartType,
} from "../../../../ts/states/result";
import { getLastEventLog } from "../../../../ts/states/test";
import { getTheme } from "../../../../ts/states/theme";
import { FaSolidIcon } from "../../../../ts/types/font-awesome";
import * as Arrays from "../../../../ts/utils/arrays";
import { cn } from "../../../../ts/utils/cn";
import { blendTwoHexColors } from "../../../../ts/utils/colors";
import { applyReducedMotion } from "../../../../ts/utils/misc";
import { toggleResultChartLegend } from "../../runtime/result";

type LegendButton = {
  id: "scale" | ResultChartLegendId;
  text: string;
  icon?: FaSolidIcon;
  line?: "solid" | "dashed";
};

const legendButtons: LegendButton[] = [
  { id: "scale", text: "scale", icon: "fa-chart-line" },
  { id: "pbLine", text: "pb", icon: "fa-crown" },
  { id: "tagPbLine", text: "tag pb", icon: "fa-tag" },
  { id: "raw", text: "raw", line: "dashed" },
  { id: "burst", text: "burst", line: "solid" },
  { id: "errors", text: "errors", icon: "fa-times" },
];

function updateColors(chart: ResultChartType, colors: Theme): void {
  const gridcolor = colors.subAlt;

  for (const scaleKey of typedKeys(chart.scales)) {
    const scale = chart.options.scales?.[scaleKey] as CartesianScaleOptions;
    scale.grid.color = gridcolor;
    scale.grid.tickColor = gridcolor;
    scale.border.color = gridcolor;
    scale.ticks.color = colors.sub;
    scale.title.color = colors.sub;
  }

  const wpm = getResultChartDataset("wpm");
  wpm.backgroundColor = "transparent";
  wpm.borderColor = colors.main;
  wpm.pointBackgroundColor = colors.main;
  wpm.pointBorderColor = colors.main;

  const raw = getResultChartDataset("raw");
  raw.backgroundColor = "transparent";
  raw.borderColor = `${colors.main}99`;
  raw.pointBackgroundColor = `${colors.main}99`;
  raw.pointBorderColor = `${colors.main}99`;

  const error = getResultChartDataset("error");
  error.backgroundColor = colors.error;
  error.borderColor = colors.error;
  error.pointBackgroundColor = colors.error;
  error.pointBorderColor = colors.error;

  const burst = getResultChartDataset("burst");
  burst.backgroundColor = blendTwoHexColors(
    colors.subAlt,
    `${colors.subAlt}00`,
    0.5,
  );
  burst.borderColor = colors.sub;
  burst.pointBackgroundColor = colors.sub;
  burst.pointBorderColor = colors.sub;

  chart.update("resize");
}

export function ResultChart(props: {
  onHighlightWords: (first: number, last: number) => void;
  onHoverChange: (hovering: boolean) => void;
}): JSXElement {
  let chart: ResultChartType | undefined;
  let prevTi: TooltipItem<"line" | "scatter"> | undefined;

  const data: ChartData<"line" | "scatter", number[]> = {
    labels: [],
    datasets: [
      {
        clip: false,
        label: "wpm",
        data: [],
        borderColor: "rgba(125, 125, 125, 1)",
        borderWidth: 3,
        yAxisID: "wpm",
        order: 2,
        pointRadius: 1,
      },
      {
        clip: false,
        label: "raw",
        data: [],
        borderColor: "rgba(125, 125, 125, 1)",
        borderWidth: 2,
        yAxisID: "raw",
        borderDash: [8, 8],
        order: 3,
        pointRadius: 0,
      },
      {
        clip: false,
        label: "errors",
        data: [],
        borderColor: "rgba(255, 125, 125, 1)",
        pointBackgroundColor: "rgba(255, 125, 125, 1)",
        borderWidth: 2,
        order: 1,
        yAxisID: "error",
        type: "scatter",
        pointStyle: "crossRot",
        pointRadius: function (context): number {
          const index = context.dataIndex;
          const value = context.dataset.data[index] as number;
          return (value ?? 0) <= 0 ? 0 : 3;
        },
        pointHoverRadius: function (context): number {
          const index = context.dataIndex;
          const value = context.dataset.data[index] as number;
          return (value ?? 0) <= 0 ? 0 : 5;
        },
      },
      {
        clip: false,
        label: "burst",
        data: [],
        borderColor: "rgba(125, 125, 125, 1)",
        borderWidth: 3,
        yAxisID: "burst",
        order: 4,
        pointRadius: 1,
      },
    ],
  };

  const options: ChartOptions<"line" | "scatter"> = {
    responsive: true,
    maintainAspectRatio: false,
    onResize: (c, size) => {
      // phones: rotated axis titles and dense ticks eat the plot width
      if (size.width === 0) return;
      const narrow = size.width < 360;
      let changed = false;
      for (const key of ["wpm", "error"] as const) {
        const scale = c.options.scales?.[key] as
          | CartesianScaleOptions
          | undefined;
        if (scale === undefined) continue;
        const display = !narrow;
        if (scale.title.display !== display) {
          scale.title.display = display;
          changed = true;
        }
        const maxTicksLimit = narrow ? 4 : 11;
        if (scale.ticks.maxTicksLimit !== maxTicksLimit) {
          scale.ticks.maxTicksLimit = maxTicksLimit;
          changed = true;
        }
      }
      if (changed) c.update("none");
    },
    scales: {
      x: {
        axis: "x",
        ticks: {
          autoSkip: true,
          autoSkipPadding: 20,
        },
        display: true,
        title: {
          display: false,
          text: "Seconds",
        },
      },
      wpm: {
        axis: "y",
        display: true,
        title: {
          display: true,
          text: "Words per Minute",
        },
        beginAtZero: true,
        min: 0,
        ticks: {
          autoSkip: true,
          autoSkipPadding: 20,
        },
        grid: {
          display: true,
        },
      },
      raw: {
        axis: "y",
        display: false,
        title: {
          display: true,
          text: "Raw Words per Minute",
        },
        beginAtZero: true,
        min: 0,
        ticks: {
          autoSkip: true,
          autoSkipPadding: 20,
        },
        grid: {
          display: false,
        },
      },
      burst: {
        axis: "y",
        display: false,
        title: {
          display: true,
          text: "Burst Words per Minute",
        },
        beginAtZero: true,
        min: 0,
        ticks: {
          autoSkip: true,
          autoSkipPadding: 20,
        },
        grid: {
          display: false,
        },
      },
      error: {
        axis: "y",
        display: true,
        position: "right",
        title: {
          display: true,
          text: "Errors",
        },
        beginAtZero: true,
        ticks: {
          precision: 0,
          autoSkip: true,
          autoSkipPadding: 20,
        },
        grid: {
          display: false,
        },
      },
    },
    plugins: {
      annotation: {
        annotations: [],
      },
      tooltip: {
        animation: { duration: applyReducedMotion(250) },
        mode: "index",
        intersect: false,
        callbacks: {
          afterLabel: function (ti): string {
            if (prevTi === ti) return "";
            const eventLog = getLastEventLog();
            if (eventLog === null) return "";

            prevTi = ti;
            try {
              const keypressIndex = Math.round(parseFloat(ti.label)) - 1;
              const wordsToHighlight = getWordIndexesForSecond(
                eventLog,
                keypressIndex,
              );

              const unique = [...new Set(wordsToHighlight)];
              const firstHighlightWordIndex = unique[0];
              const lastHighlightWordIndex =
                Arrays.lastElementFromArray(unique);
              if (
                firstHighlightWordIndex === undefined ||
                lastHighlightWordIndex === undefined
              ) {
                return "";
              }
              props.onHighlightWords(
                firstHighlightWordIndex,
                lastHighlightWordIndex,
              );
            } catch {}
            return "";
          },
        },
      },
    },
  };

  createDebouncedEffectOn(125, getTheme, (theme) => {
    if (chart !== undefined) updateColors(chart, theme);
  });

  onCleanup(() => {
    if (chart !== undefined && getResultChart() === chart) {
      setResultChart(undefined);
    }
  });

  const isActive = (id: LegendButton["id"]): boolean =>
    id === "scale" || resultState.chartLegend.visibility[id];

  const isHidden = (id: LegendButton["id"]): boolean =>
    (id === "pbLine" && !resultState.chartLegend.pbLineVisible) ||
    (id === "tagPbLine" && !resultState.chartLegend.tagPbLineVisible);

  return (
    <div
      class={cn(
        "chart group/chart relative h-[200px] max-h-[200px] w-full [grid-area:chart] max-md:h-[min(15rem,70vw)] max-md:max-h-[min(15rem,70vw)]",
        resultState.noStress && "hidden",
      )}
    >
      <div class="chartLegend pointer-events-none absolute right-0 bottom-[-0.75em] flex cursor-pointer max-sm:flex-wrap max-sm:justify-end rounded bg-bg p-[0.25em] text-[0.75em] opacity-0 transition-[opacity] duration-125 ease-[ease] group-hover/chart:pointer-events-auto group-hover/chart:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100">
        <For each={legendButtons}>
          {(button) => (
            <button
              type="button"
              class={cn(
                "text inline-grid grid-cols-[auto_1fr] items-center px-[1em] py-[0.5em] text-sub line-through [--color:var(--sub-color)] hover:bg-sub-alt hover:text-text active:text-sub",
                isActive(button.id) && "active no-underline",
                isActive(button.id) &&
                  button.id === "raw" &&
                  "[--color:var(--main-color)]",
                isActive(button.id) &&
                  button.id === "errors" &&
                  "[--color:var(--error-color)]",
                isHidden(button.id) && "hidden",
              )}
              tabIndex={-1}
              data-id={button.id}
              onClick={() => toggleResultChartLegend(button.id)}
            >
              <Show when={button.icon}>
                {(icon) => (
                  <Fa icon={icon()} class="leading-0 text-(--color)" />
                )}
              </Show>
              <Show when={button.line}>
                {(line) => (
                  <div
                    class={cn(
                      "line pointer-events-none h-[0.25em] w-[1.5em] rounded-half bg-(--color) transition-[background] duration-125 ease-[ease]",
                      line() === "dashed" &&
                        "dashed bg-[linear-gradient(90deg,var(--color)_0%,var(--color)_40%,transparent_40%,transparent_60%,var(--color)_60%,var(--color)_100%)]",
                    )}
                  ></div>
                )}
              </Show>
              <div class="text pointer-events-none">{button.text}</div>
            </button>
          )}
        </For>
      </div>
      <ChartJs
        name="result"
        id="wpmChart"
        class="h-full"
        type="line"
        data={data}
        options={options}
        onChartInit={(c) => {
          chart = c;
          setResultChart(c);
        }}
        onMouseEnter={() => props.onHoverChange(true)}
        onMouseLeave={() => props.onHoverChange(false)}
      />
    </div>
  );
}
