import {
  AnimationSpec,
  BarController,
  BarElement,
  CartesianScaleOptions,
  CategoryScale,
  Chart,
  ChartData,
  ChartOptions,
  ChartType,
  DefaultDataPoint,
  Filler,
  FontSpec,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  ScaleChartOptions,
  ScriptableAndScriptableOptions,
  ScatterController,
  TimeScale,
  TimeSeriesScale,
  Tooltip,
} from "chart.js";
import "chartjs-adapter-date-fns";
import chartAnnotation from "chartjs-plugin-annotation";
import { createDeferred, JSXElement, onCleanup, onMount } from "solid-js";

import { Theme } from "../../constants/themes";
import { createEffectOn } from "../../hooks/effects";
import { useRef } from "../../hooks/useRef";
import { getFontFamily } from "../../states/app";
import { getTheme } from "../../states/theme";
import { cn } from "../../utils/cn";

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  ScatterController,
  TimeScale,
  TimeSeriesScale,
  Tooltip,
  chartAnnotation,
);

(
  Chart.defaults.animation as AnimationSpec<"line" | "bar" | "scatter">
).duration = 0;
Chart.defaults.elements.line.tension = 0.5;
Chart.defaults.elements.line.fill = "origin";

// Touch screens cannot hover a single data point, so tooltips should follow
// the nearest point and chart text should be a little larger.
const isCoarsePointer =
  typeof window !== "undefined" &&
  window.matchMedia?.("(pointer: coarse)").matches;
if (isCoarsePointer) {
  Chart.defaults.interaction.mode = "nearest";
  Chart.defaults.interaction.intersect = false;
  Chart.defaults.font.size = 13;
}

type ChartJSProps<
  T extends ChartType = ChartType,
  TData = DefaultDataPoint<T>,
> = {
  name: string;
  type: T;
  data: ChartData<T, TData>;
  options?: ChartOptions<T>;
  onChartInit?: (chart: Chart<T, TData>) => void;
  id?: string;
  class?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

export function ChartJs<T extends ChartType, TData = DefaultDataPoint<T>>(
  props: ChartJSProps<T, TData>,
): JSXElement {
  // Refs are assigned by SolidJS via the ref attribute
  const [canvasRef, canvasEl] = useRef<HTMLCanvasElement>();

  let chart: Chart<T, TData> | undefined;
  let mountObserver: MutationObserver | undefined;
  const redraw = (): void => chart?.update("none");

  onMount(() => {
    const canvas = canvasEl();
    if (canvas === undefined) return;
    if (chart !== undefined) return;

    // Cached pages can own a canvas before Solid attaches it to the document.
    // Chart.js needs a connected canvas to read styles and observe its size.
    const initialize = (): void => {
      if (!canvas.isConnected || chart !== undefined) return;
      mountObserver?.disconnect();
      chart = new Chart(canvas, {
        type: props.type,
        data: props.data,
        options: chartOptions(canvas),
      });
      props.onChartInit?.(chart);
      // A canvas may first draw with a fallback while its web font downloads.
      void document.fonts?.ready.then(redraw);
    };
    initialize();
    if (chart === undefined) {
      mountObserver = new MutationObserver(initialize);
      mountObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }
    document.fonts?.addEventListener("loadingdone", redraw);
    onCleanup(() => document.fonts?.removeEventListener("loadingdone", redraw));
  });

  const chartOptions = (canvas: HTMLCanvasElement): ChartOptions<T> => {
    const family = getFontFamily() ?? getComputedStyle(canvas).fontFamily;
    const tooltip = props.options?.plugins?.tooltip;
    const options = {
      ...props.options,
      plugins: {
        ...props.options?.plugins,
        tooltip: {
          ...tooltip,
          bodyFont: withFontFamily(tooltip?.bodyFont, family),
          titleFont: withFontFamily(tooltip?.titleFont, family),
          footerFont: withFontFamily(tooltip?.footerFont, family),
        },
      },
    } as NonNullable<ChartOptions<T>>;
    options.font = {
      ...options.font,
      family,
    };
    return addColorsToOptions(options, getTheme, family);
  };

  const updateChart = (data: ChartData<T, TData>): void => {
    if (!chart) return;

    chart.data = data;

    chart.options = chartOptions(chart.canvas);

    chart.update("none");
  };

  // Canvas text does not inherit CSS. Keep each chart on its app's font stack.
  createEffectOn(getFontFamily, () => updateChart(props.data), { defer: true });

  const deferredData = createDeferred(() => props.data, { timeoutMs: 500 });

  createEffectOn(deferredData, (data) => updateChart(data), { defer: true });

  onCleanup(() => {
    mountObserver?.disconnect();
    chart?.destroy();
    chart = undefined;
  });

  return (
    <canvas
      role="img"
      aria-label={`${props.name} chart`}
      id={props.id}
      class={cn("chartCanvas", props.class)}
      ref={canvasRef}
      onMouseEnter={() => props.onMouseEnter?.()}
      onMouseLeave={() => props.onMouseLeave?.()}
    ></canvas>
  );
}

function addColorsToOptions<TType extends ChartType = ChartType>(
  options: ChartOptions<TType>,
  theme: () => Theme,
  family: string,
): ChartOptions<TType> {
  //axis colors
  const chartScaleOptions = options as ScaleChartOptions<TType>;
  Object.keys(chartScaleOptions.scales ?? {}).forEach((scaleID) => {
    const axis = chartScaleOptions.scales[scaleID] as CartesianScaleOptions;
    axis.ticks = {
      ...axis.ticks,
      color: theme().sub,
      font: withFontFamily(axis.ticks?.font, family),
    };
    axis.title = {
      ...axis.title,
      color: theme().sub,
      font: withFontFamily(axis.title?.font, family),
    };
    axis.border = { ...axis.border, color: theme().subAlt };
    axis.grid = {
      ...axis.grid,
      color: theme().subAlt,
      tickColor: theme().subAlt,
    };
  });

  return options;
}

function withFontFamily<TContext>(
  font: ScriptableAndScriptableOptions<Partial<FontSpec>, TContext> | undefined,
  family: string,
): ScriptableAndScriptableOptions<Partial<FontSpec>, TContext> {
  return typeof font === "function"
    ? (context, options) => ({ ...font(context, options), family })
    : { ...font, family };
}
