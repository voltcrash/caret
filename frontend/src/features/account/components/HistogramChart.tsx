import { Mode } from "@caret/schemas/shared";
import { createMemo, JSXElement } from "solid-js";

import { ChartJs } from "#shared/components/common/ChartJs.tsx";
import { SnapshotResult } from "#shared/constants/default-snapshot.ts";
import { getTheme } from "#shared/states/theme.ts";
import { TypingSpeedUnitSettings } from "#shared/utils/typing-speed-units.ts";

export function HistogramChart(props: {
  results: SnapshotResult<Mode>[];
  typingSpeedUnit: TypingSpeedUnitSettings;
}): JSXElement {
  const buckets = createMemo(() =>
    groupIntoBuckets(
      props.results.map((it) => props.typingSpeedUnit.fromWpm(it.wpm)),
      props.typingSpeedUnit.histogramDataBucketSize,
    ),
  );

  return (
    <div style={{ height: "200px" }}>
      <ChartJs
        name="Histogram"
        type="bar"
        data={{
          datasets: [
            {
              label: "Tests",
              data: buckets(),
              backgroundColor: getTheme().main,
              borderColor: getTheme().main,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          hover: {
            mode: "nearest",
            intersect: false,
          },
          scales: {
            x: {
              axis: "x",
              bounds: "ticks",
              display: true,
              title: {
                display: false,
                text: "Bucket",
              },
            },
            y: {
              axis: "y",
              beginAtZero: true,
              ticks: {
                autoSkip: true,
                autoSkipPadding: 20,
                stepSize: 10,
              },
              display: true,
              title: {
                display: true,
                text: "Tests",
              },
            },
          },
          plugins: {
            annotation: {
              annotations: [],
            },
            tooltip: {
              animation: { duration: 250 },
              intersect: false,
              mode: "index",
            },
          },
        }}
      />
    </div>
  );
}
function groupIntoBuckets(
  arr: number[],
  bucketSize: number,
): { x: string; y: number }[] {
  if (arr.length === 0) return [];
  const buckets: Record<number, number> = {};
  const maxValue = Math.max(...arr);
  const maxBucketStart = Math.floor(maxValue / bucketSize) * bucketSize;

  for (const item of arr) {
    const bucketStart = Math.floor(Math.round(item) / bucketSize) * bucketSize;
    buckets[bucketStart] = (buckets[bucketStart] ?? 0) + 1;
  }

  const result: { x: string; y: number }[] = [];

  for (let start = 0; start <= maxBucketStart; start += bucketSize) {
    const end = start + bucketSize - 1;
    const label = `${start}-${end}`;

    result.push({
      x: label,
      y: buckets[start] ?? 0,
    });
  }

  return result;
}
