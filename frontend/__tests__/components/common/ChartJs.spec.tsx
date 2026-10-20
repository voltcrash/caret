import type { ChartConfiguration, ChartOptions } from "chart.js";

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
  Reflect.deleteProperty(document, "fonts");
});

function mountChart(
  container?: HTMLElement,
  options?: ChartOptions<"bar">,
): Chart<"bar"> {
  let chart: Chart<"bar"> | undefined;
  render(
    () => (
      <ChartJs
        name="font regression"
        type="bar"
        data={{ labels: ["one"], datasets: [{ data: [1] }] }}
        options={options}
        onChartInit={(value) => (chart = value)}
      />
    ),
    container === undefined ? undefined : { container },
  );
  return chart as Chart<"bar">;
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

it("sets axis and tooltip fonts explicitly while retaining their size and weight", () => {
  setFontFamily('"Fira Code", monospace');
  const chart = mountChart(undefined, {
    scales: {
      x: { ticks: { font: { size: 18 } }, title: { font: { weight: "bold" } } },
    },
    plugins: { tooltip: { titleFont: { weight: "bold" } } },
  });
  setFontFamily('"JetBrains Mono", monospace');
  const family = '"JetBrains Mono", monospace';
  expect(chart.options.scales?.["x"]).toMatchObject({
    ticks: { font: { family, size: 18 } },
    title: { font: { family, weight: "bold" } },
  });
  expect(chart.options.plugins?.tooltip).toMatchObject({
    bodyFont: { family },
    titleFont: { family, weight: "bold" },
    footerFont: { family },
  });
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

it("redraws after initial and later web fonts load, then removes its listener", async () => {
  const ready = Promise.withResolvers<undefined>();
  const fonts = Object.assign(new EventTarget(), { ready: ready.promise });
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: fonts,
  });
  const chart = mountChart();
  expect(chart.update).not.toHaveBeenCalled();
  ready.resolve(undefined);
  await ready.promise;
  expect(chart.update).toHaveBeenCalledOnce();
  fonts.dispatchEvent(new Event("loadingdone"));
  expect(chart.update).toHaveBeenCalledTimes(2);

  cleanup();
  fonts.dispatchEvent(new Event("loadingdone"));
  expect(chart.update).toHaveBeenCalledTimes(2);
  expect(chart.destroy).toHaveBeenCalledOnce();
});

it("ignores a font download finishing after unmount", async () => {
  const ready = Promise.withResolvers<undefined>();
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: Object.assign(new EventTarget(), { ready: ready.promise }),
  });
  const chart = mountChart();
  cleanup();
  ready.resolve(undefined);
  await ready.promise;
  expect(chart.update).not.toHaveBeenCalled();
});
