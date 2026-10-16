import {
  createEffect,
  createSignal,
  JSXElement,
  lazy,
  onCleanup,
  onMount,
  Show,
  Suspense,
} from "solid-js";
import { envConfig } from "virtual:env-config";

import { Fa } from "../../../../ts/components/common/Fa";
import { showErrorNotification } from "../../../../ts/states/notifications";
import {
  resultState,
  resultWordHighlightEvent,
  setResultElements,
  bindResultChartLoader,
  waitForResultChart,
} from "../../../../ts/states/result";
import { isTestActive } from "../../../../ts/states/test";
import { subscribeResultConfigChanges } from "../../runtime/result/chart-config";
import { captureTypingRoute } from "../../scope";
import { ResultButtons } from "./ResultButtons";
import { ResultLoginTip } from "./ResultLoginTip";
import { ResultReplay } from "./ResultReplay";
import { ResultStats } from "./ResultStats";
import { ResultWatermark } from "./ResultWatermark";
import { ResultWordsHistory } from "./ResultWordsHistory";
import { useResultScreen } from "./useResultScreen";
import { useScreenshotCanvas } from "./useScreenshotCanvas";

const ResultChart = lazy(async () =>
  import("./ResultChart").then((m) => ({ default: m.ResultChart })),
);

export function Result(): JSXElement {
  subscribeResultConfigChanges();
  let resultEl: HTMLDivElement | undefined;
  let wrapperEl: HTMLDivElement | undefined;
  const [chartRequested, setChartRequested] = createSignal(false);
  const prepareChart = async (): Promise<void> => {
    const lease = captureTypingRoute();
    await ResultChart.preload();
    if (!lease.isCurrent()) return;
    setChartRequested(true);
    await waitForResultChart();
  };
  onCleanup(bindResultChartLoader(prepareChart));
  createEffect(() => {
    // Warm the chart while typing; completing a short test still awaits mounting.
    if (isTestActive() && (!envConfig.isDevelopment || envConfig.devPrefetch)) {
      void prepareChart().catch((error: unknown) =>
        showErrorNotification("Could not load result chart", { error }),
      );
    }
  });

  useScreenshotCanvas();
  useResultScreen(() => resultEl);

  onMount(() => {
    onCleanup(
      setResultElements(
        resultEl as HTMLDivElement,
        wrapperEl as HTMLDivElement,
      ),
    );
  });

  return (
    // class stays static: result.ts/test-ui show, hide and fade #result.
    // col-[full-width]: the mount breaks `.content-grid > .full-width`
    <div
      id="result"
      ref={(el) => (resultEl = el)}
      class="content-grid full-width col-[full-width] hidden outline-none focus:outline-none focus-visible:outline-none [&.noBalloons_[aria-label][data-balloon-pos]]:before:hidden [&.noBalloons_[aria-label][data-balloon-pos]]:after:hidden"
      tabIndex={-1}
    >
      <Show when={resultState.noStress}>
        <div class="noStressMessage col-[1/3] pb-8 text-center text-[2rem]">
          <Fa icon="fa-check" />
        </div>
      </Show>
      <div
        ref={(el) => (wrapperEl = el)}
        class="wrapper grid grid-cols-[auto_1fr] items-center gap-4 [grid-template-areas:'stats_chart'_'morestats_morestats'] max-md:grid-cols-[minmax(0,1fr)] max-md:[grid-template-areas:'stats'_'chart'_'morestats'] [:where(&)_button]:p-[1em_2em]"
      >
        <ResultStats />
        <Show when={chartRequested()}>
          <Suspense>
            <ResultChart
              onHighlightWords={(firstWordIndex, lastWordIndex) =>
                resultWordHighlightEvent.dispatch({
                  type: "highlight",
                  firstWordIndex,
                  lastWordIndex,
                })
              }
              onHoverChange={(hovering) =>
                resultWordHighlightEvent.dispatch({
                  type: "hoverChart",
                  hovering,
                })
              }
            />
          </Suspense>
        </Show>
        <div class="bottom col-[1/-1]">
          <ResultWordsHistory />
          <ResultReplay />
          <ResultButtons />
        </div>
        <ResultLoginTip />
        <ResultWatermark />
      </div>
    </div>
  );
}
