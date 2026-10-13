import { type AnnotationOptions } from "chartjs-plugin-annotation";
import { createMemo, JSXElement, Show } from "solid-js";

import type { ScatterPoint } from "./scatter-points";

import { getTheme } from "../../../states/theme";
import { Balloon } from "../../common/Balloon";
import { ChartJs } from "../../common/ChartJs";
import "./chart-setup";

const SCATTER_HEIGHT = 170;

export function ScatterChart(props: {
  title: string;
  balloon: string;
  points: ScatterPoint[];
  xTitle: string;
  yTitle: string;
  xMax?: number;
  yMax?: number;
  xTickLabels?: string[];
  identityLine?: boolean;
}): JSXElement {
  const annotations = createMemo(() => {
    if (props.identityLine !== true) return {};
    const limit = Math.min(props.xMax ?? Infinity, props.yMax ?? Infinity);
    if (!Number.isFinite(limit)) return {};
    const identity: AnnotationOptions = {
      type: "line",
      xMin: 0,
      yMin: 0,
      xMax: limit,
      yMax: limit,
      borderColor: getTheme().sub,
      borderWidth: 1,
      borderDash: [4, 4],
    };
    return { identity };
  });

  return (
    <div class="flex flex-col gap-1">
      <Balloon
        class="cursor-help font-mono text-xs text-text underline decoration-sub decoration-dotted underline-offset-2"
        text={props.balloon}
        position="up"
        length="xlarge"
        break
      >
        {props.title}
      </Balloon>
      <Show
        when={props.points.length > 0}
        fallback={
          <div
            class="flex items-center justify-center rounded bg-bg text-xs text-sub"
            style={{ height: `${SCATTER_HEIGHT}px` }}
          >
            No data
          </div>
        }
      >
        <div style={{ height: `${SCATTER_HEIGHT}px` }}>
          <ChartJs
            name={props.title}
            type="scatter"
            data={{
              datasets: [
                {
                  label: props.title,
                  data: props.points,
                  backgroundColor: getTheme().main,
                  borderColor: getTheme().main,
                  pointRadius: 1.5,
                  pointHoverRadius: 4,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                x: {
                  type: "linear",
                  min: 0,
                  max: props.xMax,
                  title: { display: true, text: props.xTitle },
                  ticks:
                    props.xTickLabels !== undefined
                      ? {
                          stepSize: 1,
                          autoSkip: false,
                          maxRotation: 90,
                          minRotation: 90,
                          font: { size: 8 },
                          callback: (value) =>
                            props.xTickLabels?.[Math.round(Number(value))] ??
                            "",
                        }
                      : { maxTicksLimit: 6 },
                },
                y: {
                  type: "linear",
                  min: 0,
                  max: props.yMax,
                  title: { display: true, text: props.yTitle },
                  ticks: { maxTicksLimit: 5 },
                },
              },
              plugins: {
                legend: { display: false },
                annotation: { annotations: annotations() },
                tooltip: {
                  displayColors: false,
                  callbacks: {
                    label: (item) => {
                      const point = item.raw as ScatterPoint;
                      const x =
                        props.xTickLabels !== undefined
                          ? (props.xTickLabels[Math.round(point.x)] ?? "")
                          : point.x.toFixed(1);
                      return `${props.xTitle}: ${x}, ${props.yTitle}: ${point.y.toFixed(1)}`;
                    },
                  },
                },
              },
            }}
          />
        </div>
      </Show>
    </div>
  );
}
