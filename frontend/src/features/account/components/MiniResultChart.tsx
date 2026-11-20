import { ChartData } from "@caret/schemas/results";
import { useQuery } from "@tanstack/solid-query";
import { createMemo, JSXElement } from "solid-js";

import { AnimatedModal } from "#shared/components/common/AnimatedModal.tsx";
import AsyncContent from "#shared/components/common/AsyncContent.tsx";
import { ChartJs } from "#shared/components/common/ChartJs.tsx";
import { getConfig } from "#shared/config/store.ts";
import { isModalOpen } from "#shared/states/modals.ts";
import { getTheme } from "#shared/states/theme.ts";
import { get as getTypingSpeedUnit } from "#shared/utils/typing-speed-units.ts";

import { getSingleResultQueryOptions } from "../../../data/collections/results";

export function MiniResultChart(props: { resultId: string }): JSXElement {
  const query = useQuery(() => ({
    ...getSingleResultQueryOptions(props.resultId),
    enabled: isModalOpen("MiniResultChartModal"),
  }));

  const beginAtZero = createMemo(() => getConfig.startGraphsAtZero);
  const typingSpeedUnit = createMemo(() =>
    getTypingSpeedUnit(getConfig.typingSpeedUnit),
  );

  return (
    <AnimatedModal id="MiniResultChartModal" modalClass="max-w-300">
      <AsyncContent queries={{ query }}>
        {({ queryData }) => {
          const data = queryData().chartData as ChartData;

          return (
            <div class="h-60 w-full">
              <ChartJs
                name="MiniResult"
                type="line"
                data={{
                  labels: data.wpm.map((_, index) => (index + 1).toString()),
                  datasets: [
                    {
                      label: "wpm",
                      data: data.wpm.map((it) => typingSpeedUnit().fromWpm(it)),
                      borderWidth: 3,
                      yAxisID: "wpm",
                      order: 2,
                      pointRadius: 1,
                      fill: false,
                      borderColor: getTheme().main,
                      backgroundColor: getTheme().main,
                    },
                    {
                      label: "burst",
                      data: data.burst.map((it) =>
                        typingSpeedUnit().fromWpm(it),
                      ),
                      borderWidth: 3,
                      yAxisID: "wpm",
                      order: 3,
                      pointRadius: 1,
                      fill: false,
                      borderColor: getTheme().sub,
                      backgroundColor: getTheme().sub,
                    },
                    {
                      label: "errors",
                      data: data.err,
                      pointBorderColor: getTheme().error,
                      backgroundColor: getTheme().error,
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
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
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
                        text: typingSpeedUnit().fullUnitString,
                      },
                      beginAtZero: beginAtZero(),
                      ticks: {
                        autoSkip: true,
                        autoSkipPadding: 20,
                      },
                      grid: {
                        display: true,
                      },
                    },

                    error: {
                      display: true,
                      position: "right",
                      title: {
                        display: true,
                        text: "Errors",
                      },
                      beginAtZero: beginAtZero(),
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
                      animation: { duration: 250 },
                      mode: "index",
                      intersect: false,
                    },
                  },
                }}
              />
            </div>
          );
        }}
      </AsyncContent>
    </AnimatedModal>
  );
}
