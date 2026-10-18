import { useQuery } from "@tanstack/solid-query";
import { For, type JSXElement } from "solid-js";

import type { HistogramBucket } from "./stats";

import AsyncContent from "../../ts/components/common/AsyncContent";
import { ChartJs } from "../../ts/components/common/ChartJs";
import { CommandPaletteHotkey } from "../../ts/components/hotkeys/CommandPaletteHotkey";
import { QuickRestartHotkey } from "../../ts/components/hotkeys/QuickRestartHotkey";
import { getContributorsQueryOptions } from "../../ts/queries/public";
import { showModal } from "../../ts/states/modals";
import { showErrorNotification } from "../../ts/states/notifications";
import { getTheme } from "../../ts/states/theme";

function Histogram(props: {
  labels: string[];
  data: HistogramBucket[];
}): JSXElement {
  return (
    <ChartJs
      name="SpeedHistogram"
      type="bar"
      data={{
        labels: props.labels,
        datasets: [
          {
            yAxisID: "count",
            label: "Users",
            data: props.data,
            minBarLength: 2,
            backgroundColor: getTheme().main,
            borderColor: getTheme().main,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        hover: { mode: "nearest", intersect: false },
        scales: {
          x: {
            axis: "x",
            bounds: "ticks",
            display: true,
            title: { display: false, text: "Bucket" },
            offset: true,
          },
          count: {
            axis: "y",
            beginAtZero: true,
            min: 0,
            ticks: { autoSkip: true, autoSkipPadding: 20, stepSize: 10 },
            display: true,
            title: { display: true, text: "Users" },
          },
        },
        plugins: {
          annotation: { annotations: [] },
          tooltip: {
            animation: { duration: 250 },
            intersect: false,
            mode: "index",
            callbacks: {
              afterLabel: (context) =>
                (context.raw as { topPercentage?: string }).topPercentage ?? "",
            },
          },
        },
      }}
    />
  );
}

function Contributors(): JSXElement {
  const contributors = useQuery(() => getContributorsQueryOptions());
  return (
    <AsyncContent
      queries={{ contributors }}
      errorMessage="Failed to get contributors"
    >
      {({ contributorsData }) => (
        <div
          class="grid"
          style={{
            "grid-template-columns": "repeat(auto-fill, minmax(13em, 1fr))",
          }}
        >
          <For each={contributorsData()}>
            {(name) => <div class="wrap-break-word">{name}</div>}
          </For>
        </div>
      )}
    </AsyncContent>
  );
}

/** About-page browser leaves: theme-coloured chart, live hotkeys, modals. */
export const about = {
  Histogram,
  Contributors,
  QuickRestartHotkey,
  CommandPaletteHotkey,
  showModal: (id: "Support" | "Contact"): void => showModal(id),
  notifyError: (message: string, error: unknown): void => {
    showErrorNotification(message, { error });
  },
};
