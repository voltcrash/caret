import { cleanup, render, waitFor } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const { stub, environment } = vi.hoisted(() => ({
  stub: (name: string) => () => <div data-stub={name} />,
  environment: { isDevelopment: false, devPrefetch: false },
}));
vi.mock("virtual:env-config", () => ({ envConfig: environment }));
vi.mock("../../../../../src/ts/states/test", async () => {
  const { createSignal } = await import("solid-js");
  const [isTestActive, setTestActive] = createSignal(false);
  return { isTestActive, setTestActive };
});
vi.mock(
  "../../../../../src/features/typing/components/result/ResultStats",
  () => ({
    ResultStats: stub("stats"),
  }),
);
vi.mock(
  "../../../../../src/features/typing/components/result/ResultChart",
  async () => {
    const { onMount } = await import("solid-js");
    const { setResultChart } =
      await import("../../../../../src/ts/states/result");
    return {
      ResultChart: () => {
        onMount(() =>
          setResultChart({} as Parameters<typeof setResultChart>[0]),
        );
        return stub("chart")();
      },
    };
  },
);
vi.mock(
  "../../../../../src/features/typing/components/result/ResultWordsHistory",
  () => ({ ResultWordsHistory: stub("history") }),
);
vi.mock(
  "../../../../../src/features/typing/components/result/ResultReplay",
  () => ({
    ResultReplay: stub("replay"),
  }),
);
vi.mock(
  "../../../../../src/features/typing/components/result/ResultButtons",
  () => ({
    ResultButtons: stub("buttons"),
  }),
);
vi.mock(
  "../../../../../src/features/typing/components/result/ResultLoginTip",
  () => ({
    ResultLoginTip: stub("logintip"),
  }),
);
vi.mock(
  "../../../../../src/features/typing/components/result/ResultWatermark",
  () => ({
    ResultWatermark: stub("watermark"),
  }),
);

import { Result } from "../../../../../src/features/typing/components/result/Result";
import {
  getResultElement,
  getResultWrapperElement,
  setResultState,
  setResultChart,
  prepareResultChart,
} from "../../../../../src/ts/states/result";
import { setTestActive } from "../../../../../src/ts/states/test";

describe("Result", () => {
  afterEach(() => {
    cleanup();
    setResultState("noStress", false);
    setTestActive(false);
    setResultChart(undefined);
    environment.isDevelopment = false;
    environment.devPrefetch = false;
  });

  it("renders the result layout and exposes its elements", () => {
    const { container } = render(() => <Result />);
    const result = container.querySelector("#result");
    expect(result).toHaveClass("hidden");
    expect(result).toHaveAttribute("tabindex", "-1");
    expect(getResultElement()).toBe(result);
    expect(getResultWrapperElement()).toBe(result?.querySelector(".wrapper"));
    expect(
      [...container.querySelectorAll("[data-stub]")].map((e) =>
        e.getAttribute("data-stub"),
      ),
    ).toEqual([
      "stats",
      "history",
      "replay",
      "buttons",
      "logintip",
      "watermark",
    ]);
    expect(
      container.querySelector(".bottom [data-stub=history]"),
    ).not.toBeNull();
  });

  it("loads the chart during the first test and keeps it mounted afterward", async () => {
    const { container } = render(() => <Result />);
    expect(container.querySelector("[data-stub=chart]")).toBeNull();
    setTestActive(true);
    await waitFor(() =>
      expect(container.querySelector("[data-stub=chart]")).not.toBeNull(),
    );
    await prepareResultChart();
    const chart = container.querySelector("[data-stub=chart]");
    setTestActive(false);
    expect(container.querySelector("[data-stub=chart]")).toBe(chart);
  });

  it("waits for chart mounting even when a result is requested immediately", async () => {
    const { container } = render(() => <Result />);
    await prepareResultChart();
    expect(container.querySelector("[data-stub=chart]")).not.toBeNull();
  });

  it.each([false, true])(
    "makes development chart warmup opt-in (%s)",
    async (enabled) => {
      environment.isDevelopment = true;
      environment.devPrefetch = enabled;
      const { container } = render(() => <Result />);
      setTestActive(true);
      if (enabled) {
        await waitFor(() =>
          expect(container.querySelector("[data-stub=chart]")).not.toBeNull(),
        );
      } else {
        await Promise.resolve();
        expect(container.querySelector("[data-stub=chart]")).toBeNull();
      }
      await prepareResultChart();
      expect(container.querySelector("[data-stub=chart]")).not.toBeNull();
    },
  );

  it("shows the glarses mode check mark", () => {
    const { container } = render(() => <Result />);
    expect(container.querySelector(".noStressMessage")).toBeNull();
    setResultState("noStress", true);
    const message = container.querySelector("#result > .noStressMessage");
    expect(message?.querySelector("i")).toHaveClass("fa-check");
  });
});
