import type { ChartOptions } from "chart.js";

import { cleanup, fireEvent, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  toggleResultChartLegend: vi.fn(),
  getWordIndexesForSecond: vi.fn(),
  options: undefined as ChartOptions<"line" | "scatter"> | undefined,
  chart: { id: "chart" },
}));

vi.mock("../../../../../src/features/typing/runtime/result", () => ({
  toggleResultChartLegend: mocks.toggleResultChartLegend,
}));
vi.mock("@oxytype/typing-core/events/stats", () => ({
  getWordIndexesForSecond: mocks.getWordIndexesForSecond,
}));
vi.mock("../../../../../src/ts/states/test", () => ({
  getLastEventLog: () => [],
}));
vi.mock("../../../../../src/ts/components/common/ChartJs", () => ({
  ChartJs: (props: {
    id: string;
    options: ChartOptions<"line" | "scatter">;
    onChartInit: (chart: unknown) => void;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  }) => {
    mocks.options = props.options;
    props.onChartInit(mocks.chart);
    return (
      <canvas
        id={props.id}
        onMouseEnter={() => props.onMouseEnter()}
        onMouseLeave={() => props.onMouseLeave()}
      />
    );
  },
}));

import { ResultChart } from "../../../../../src/features/typing/components/result/ResultChart";
import {
  getResultChart,
  setResultState,
} from "../../../../../src/ts/states/result";

const onHighlightWords = vi.fn();
const onHoverChange = vi.fn();

function renderChart(): HTMLElement {
  const { container } = render(() => (
    <ResultChart
      onHighlightWords={onHighlightWords}
      onHoverChange={onHoverChange}
    />
  ));
  return container;
}

const button = (container: HTMLElement, id: string): HTMLElement =>
  container.querySelector(
    `.chartLegend button[data-id="${id}"]`,
  ) as HTMLElement;

describe("ResultChart", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    setResultState({
      noStress: false,
      chartLegend: {
        visibility: {
          raw: false,
          burst: false,
          errors: false,
          pbLine: false,
          tagPbLine: false,
        },
        pbLineVisible: true,
        tagPbLineVisible: true,
      },
    });
  });

  it("registers the chart instance", () => {
    renderChart();
    expect(getResultChart()).toBe(mocks.chart);
  });

  it("renders legend state from the store", () => {
    const container = renderChart();
    expect(button(container, "scale")).toHaveClass("active");
    expect(button(container, "raw")).not.toHaveClass("active");

    setResultState("chartLegend", {
      visibility: {
        raw: true,
        burst: false,
        errors: true,
        pbLine: true,
        tagPbLine: false,
      },
      pbLineVisible: true,
      tagPbLineVisible: false,
    });

    expect(button(container, "raw")).toHaveClass("active");
    expect(button(container, "burst")).not.toHaveClass("active");
    expect(button(container, "errors")).toHaveClass("active");
    expect(button(container, "pbLine")).not.toHaveClass("hidden");
    expect(button(container, "tagPbLine")).toHaveClass("hidden");
  });

  it("toggles legend items", () => {
    const container = renderChart();
    fireEvent.click(button(container, "burst"));
    expect(mocks.toggleResultChartLegend).toHaveBeenCalledWith("burst");
    fireEvent.click(button(container, "scale"));
    expect(mocks.toggleResultChartLegend).toHaveBeenCalledWith("scale");
  });

  it("is hidden in no stress mode", () => {
    const container = renderChart();
    expect(container.querySelector(".chart")).not.toHaveClass("hidden");
    setResultState("noStress", true);
    expect(container.querySelector(".chart")).toHaveClass("hidden");
  });

  it("reports chart hover", () => {
    const container = renderChart();
    const canvas = container.querySelector("#wpmChart") as HTMLElement;
    fireEvent.mouseEnter(canvas);
    expect(onHoverChange).toHaveBeenLastCalledWith(true);
    fireEvent.mouseLeave(canvas);
    expect(onHoverChange).toHaveBeenLastCalledWith(false);
  });

  it("highlights words for the hovered second", () => {
    renderChart();
    mocks.getWordIndexesForSecond.mockReturnValue([3, 3, 4, 6]);

    const afterLabel = mocks.options?.plugins?.tooltip?.callbacks
      ?.afterLabel as (ti: unknown) => string;
    expect(afterLabel({ label: "2" })).toBe("");

    expect(mocks.getWordIndexesForSecond).toHaveBeenCalledWith([], 1);
    expect(onHighlightWords).toHaveBeenCalledWith(3, 6);
  });
});
