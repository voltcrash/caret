import type { ChartConfiguration } from "chart.js";

import { cleanup, render, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("chart.js", async (original) => {
  const actual = await original<typeof import("chart.js")>();
  return {
    ...actual,
    Chart: class {
      static register = vi.fn();
      static defaults = {
        animation: {},
        elements: { line: {} },
        font: { family: "default" },
      };
      data: ChartConfiguration["data"];
      options: ChartConfiguration["options"];
      canvas: HTMLCanvasElement;
      update = vi.fn();
      destroy = vi.fn();
      constructor(canvas: HTMLCanvasElement, config: ChartConfiguration) {
        this.canvas = canvas;
        this.data = config.data;
        this.options = config.options;
        mocks.create(this);
      }
    },
  };
});

import { Chart } from "chart.js";

import { ChartJs } from "../../../src/ts/components/common/ChartJs";
import { setFontFamily } from "../../../src/ts/states/app";

beforeEach(() => {
  setFontFamily(undefined);
  mocks.create.mockClear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function mountChart(container?: HTMLElement): Chart {
  let chart: Chart | undefined;
  render(
    () => (
      <ChartJs
        name="font regression"
        type="bar"
        data={{ labels: ["one"], datasets: [{ data: [1] }] }}
        onChartInit={(value) => (chart = value)}
      />
    ),
    container === undefined ? undefined : { container },
  );
  return chart as Chart;
}

it("uses the selected font on first render and updates existing charts", () => {
  const family = '"Fira Code", "Roboto Mono", monospace';
  setFontFamily(family);
  const chart = mountChart();
  expect(chart.options.font?.family).toBe(family);
  expect(Chart.defaults.font.family).toBe("default");

  setFontFamily('"JetBrains Mono", monospace');
  expect(chart.options.font?.family).toBe('"JetBrains Mono", monospace');
  expect(chart.update).toHaveBeenCalledWith("none");
});

it("inherits the canvas font before the app font is ready", () => {
  vi.spyOn(window, "getComputedStyle").mockReturnValue({
    fontFamily: '"Roboto Mono", monospace',
  } as CSSStyleDeclaration);
  const chart = mountChart();
  expect(chart.options.font?.family).toBe('"Roboto Mono", monospace');
});

it("initializes a detached cached canvas with the latest font", async () => {
  const container = document.createElement("div");
  mountChart(container);
  expect(mocks.create).not.toHaveBeenCalled();
  setFontFamily('"Fira Code", monospace');
  document.body.append(container);
  await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
  const chart = mocks.create.mock.calls[0]?.[0] as Chart;
  expect(chart.options.font?.family).toBe('"Fira Code", monospace');
});
