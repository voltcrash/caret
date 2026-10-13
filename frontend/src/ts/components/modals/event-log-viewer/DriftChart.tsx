import { For, JSXElement } from "solid-js";

import type { DriftPoint } from "./video-sync";

export function DriftChart(props: {
  data: DriftPoint[];
  minMs: number;
  maxMs: number;
}): JSXElement {
  const HEIGHT = 60;
  const range = (): number => Math.max(props.maxMs - props.minMs, 1);
  const xPct = (ms: number): number => ((ms - props.minMs) / range()) * 100;
  const yMaxAbs = (): number => {
    let max = 50;
    for (const p of props.data) {
      if (Math.abs(p.driftMs) > max) max = Math.abs(p.driftMs);
    }
    return Math.ceil(max);
  };
  const yPx = (drift: number): number =>
    HEIGHT / 2 - (drift / yMaxAbs()) * (HEIGHT / 2 - 4);

  return (
    <div class="bg-bg-secondary relative w-full overflow-hidden rounded">
      <div
        class="absolute top-0 right-0 px-1 font-mono text-xs text-sub"
        style={{ "line-height": "1" }}
      >
        +{yMaxAbs()}ms
      </div>
      <div
        class="absolute right-0 bottom-0 px-1 font-mono text-xs text-sub"
        style={{ "line-height": "1" }}
      >
        −{yMaxAbs()}ms
      </div>
      <div
        class="absolute left-1 px-1 font-mono text-xs text-sub"
        style={{ top: `${HEIGHT / 2 - 6}px`, "line-height": "1" }}
      >
        drift
      </div>
      <div class="relative w-full" style={{ height: `${HEIGHT}px` }}>
        <div
          class="absolute right-0 left-0 h-px bg-sub"
          style={{ top: `${HEIGHT / 2}px` }}
        ></div>
        <For each={props.data}>
          {(p) => (
            <div
              class="absolute rounded-full bg-main"
              title={`${p.label}: ${p.driftMs.toFixed(2)}ms @ test ${p.eventTestMs.toFixed(2)}ms`}
              style={{
                left: `calc(${xPct(p.eventTestMs)}% - 3px)`,
                top: `${yPx(p.driftMs) - 3}px`,
                width: "6px",
                height: "6px",
              }}
            ></div>
          )}
        </For>
      </div>
    </div>
  );
}
