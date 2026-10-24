import { type AnnotationOptions } from "chartjs-plugin-annotation";
import { createMemo, JSXElement, Show } from "solid-js";

import { requireBrowserAudit } from "../../../../features/typing/audit.client";
import { getTheme } from "../../../states/theme";
import { ChartJs } from "../../common/ChartJs";
import "./chart-setup";
import {
  bucketLabels,
  bucketRangeLabel,
  bucketRangeMs,
  BUCKETS,
  type BucketSpec,
  buildHistogram,
  categoryPosition,
  getBucketDivisor,
  histogramTooltipLines,
} from "./histogram";
import { Stat } from "./Stat";
import { formatQuantum, formatSignificant, formatSigmas } from "./stat-format";
import {
  isLowStat,
  type MetricKind,
  MIN_SAMPLE_FOR_FLAGS,
  statBalloon,
  SUSPICIOUS,
  type SuspicionLimits,
} from "./stat-notes";

const HISTOGRAM_HEIGHT = 160;

export function DistributionChart(props: {
  label: string;
  kind: MetricKind;
  values: number[];
  /** the whole log's values, used only to fix the bucket scale */
  scaleValues: number[];
  note?: string;
}): JSXElement {
  // the viewer opens only once the audit module has loaded
  const audit = requireBrowserAudit();
  const stats = createMemo(() => audit.distribution(props.values));

  const spec = (): BucketSpec => BUCKETS[props.kind];

  // spacing buckets are multiples of the median, so every value is scaled by it
  // before being bucketed. taken from the whole log rather than what is
  // currently visible, so the buckets do not slide around underneath the bars
  // while the timeline plays
  const divisor = createMemo(() =>
    getBucketDivisor(spec(), props.scaleValues, audit),
  );

  const histogram = createMemo(() =>
    buildHistogram(spec(), props.values, divisor()),
  );

  // gaps between keys are multiplicative so the bell is expected on their
  // logs, hold times are already on the scale they are symmetric on
  const bell = createMemo(() =>
    audit.bellness(props.values, props.kind === "spacing"),
  );

  const limits = (): SuspicionLimits => SUSPICIOUS[props.kind];

  const isLow = (value: number | null, limit: number): boolean =>
    isLowStat(value, limit, stats()?.n ?? 0);

  const chartData = createMemo(() => ({
    labels: bucketLabels(spec()),
    datasets: [
      {
        label: props.label,
        data: histogram().bins,
        backgroundColor: getTheme().main,
        borderColor: getTheme().main,
        barPercentage: 1,
        categoryPercentage: 1,
      },
    ],
  }));

  const percentileAnnotations = createMemo(() => {
    const s = stats();
    if (s === null) return {};
    const theme = getTheme();
    const line = (
      value: number,
      label: string,
      color: string,
    ): AnnotationOptions => ({
      type: "line",
      xMin: categoryPosition(spec(), value / divisor()),
      xMax: categoryPosition(spec(), value / divisor()),
      borderColor: color,
      borderWidth: 1,
      label: {
        display: true,
        content: label,
        position: "start",
        backgroundColor: theme.bg,
        color: theme.sub,
        font: { size: 9 },
        padding: 2,
      },
    });
    return {
      p10: line(s.p10, "p10", theme.sub),
      p50: line(s.p50, "p50", theme.text),
      p90: line(s.p90, "p90", theme.sub),
    };
  });

  return (
    <div class="flex min-w-0 flex-1 flex-col gap-1 sm:min-w-80">
      <div class="flex items-baseline justify-between gap-2">
        <div class="font-mono text-xs text-text">{props.label}</div>
        <Show when={props.note}>
          <div class="text-xs text-sub">{props.note}</div>
        </Show>
      </div>
      <Show
        when={stats()}
        fallback={
          <div
            class="flex items-center justify-center rounded bg-bg text-xs text-sub"
            style={{ height: `${HISTOGRAM_HEIGHT}px` }}
          >
            No data
          </div>
        }
      >
        {(s) => (
          <>
            <div style={{ height: `${HISTOGRAM_HEIGHT}px` }}>
              <ChartJs
                name={`${props.label}-distribution`}
                type="bar"
                data={chartData()}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    x: {
                      type: "category",
                      title: { display: true, text: spec().axisTitle },
                      grid: { offset: false },
                      // every bucket keeps its label, including empty ones -
                      // an empty bucket is itself a finding
                      ticks: {
                        autoSkip: false,
                        maxRotation: 0,
                        minRotation: 0,
                      },
                    },
                    y: {
                      beginAtZero: true,
                      title: { display: true, text: "count" },
                      ticks: { precision: 0, maxTicksLimit: 5 },
                    },
                  },
                  plugins: {
                    legend: { display: false },
                    annotation: { annotations: percentileAnnotations() },
                    tooltip: {
                      displayColors: false,
                      callbacks: {
                        title: (items) => {
                          const index = items[0]?.dataIndex;
                          if (index === undefined) return "";
                          return bucketRangeLabel(spec(), index);
                        },
                        label: (item) => {
                          const lines = histogramTooltipLines(
                            histogram(),
                            item.dataIndex,
                          );
                          if (spec().relativeToMedian) {
                            lines.unshift(
                              `median ${s().p50.toFixed(1)}ms, so ${bucketRangeMs(spec(), item.dataIndex, divisor())}`,
                            );
                          }
                          return lines;
                        },
                      },
                    },
                  },
                }}
              />
            </div>
            <div class="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs">
              <Stat
                label="n"
                value={String(s().n)}
                balloon={statBalloon("n", props.kind)}
                warn={s().n < MIN_SAMPLE_FOR_FLAGS}
              />
              <Stat
                label="p10/50/90"
                value={`${s().p10.toFixed(1)}/${s().p50.toFixed(1)}/${s().p90.toFixed(1)}ms`}
                balloon={statBalloon("percentiles", props.kind)}
                bad={isLow(s().p50, limits().median)}
              />
              <Stat
                label="max"
                value={`${s().max.toFixed(0)}ms`}
                balloon="Largest value in the sample. The last bucket is open ended, so this is the only place an extreme outlier shows up - a long pause, or a key that was held down while the typist did something else."
              />
              <Stat
                label="mean"
                value={`${s().mean.toFixed(1)}ms`}
                balloon={statBalloon("mean", props.kind)}
              />
              <Stat
                label="sd"
                value={`${s().sd.toFixed(1)}ms`}
                balloon={statBalloon("sd", props.kind)}
              />
              <Stat
                label="cv"
                value={s().cv.toFixed(2)}
                balloon={statBalloon("cv", props.kind)}
                bad={isLow(s().cv, limits().cv)}
              />
              <Stat
                label="lo"
                value={s().spreadLow?.toFixed(2) ?? "-"}
                balloon={statBalloon("spreadLow", props.kind)}
                bad={isLow(s().spreadLow, limits().spreadLow)}
              />
              <Stat
                label="hi"
                value={s().spreadHigh?.toFixed(2) ?? "-"}
                balloon={statBalloon("spreadHigh", props.kind)}
              />
              <Stat
                label="acf1"
                value={formatSignificant(s().autocorrelation)}
                balloon={statBalloon("acf1", props.kind)}
              />
              <Stat
                label="runs"
                value={formatSigmas(s().runsZ)}
                balloon={statBalloon("runs", props.kind)}
              />
              <Stat
                label="drift"
                value={s().drift?.toFixed(2) ?? "-"}
                balloon={statBalloon("drift", props.kind)}
              />
              <Stat
                label="quantum"
                value={formatQuantum(s().quantum)}
                balloon={statBalloon("quantum", props.kind)}
              />
              <Stat
                label="distinct"
                value={String(s().distinctCount)}
                balloon={statBalloon("distinct", props.kind)}
                bad={isLow(s().distinctCount, limits().distinct)}
              />
              <Stat
                label="bell"
                value={bell()?.toFixed(3) ?? "-"}
                balloon={statBalloon("bell", props.kind)}
                bad={isLow(bell(), limits().bell)}
              />
              <Stat
                label="skew"
                value={s().skew.toFixed(2)}
                balloon={statBalloon("skew", props.kind)}
                bad={isLow(s().skew, limits().skew)}
              />
            </div>
          </>
        )}
      </Show>
    </div>
  );
}
