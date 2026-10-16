import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

// children have their own specs
vi.mock(
  "../../../../../src/features/typing/components/result/ResultQuoteActions",
  () => ({ ResultQuoteActions: () => null }),
);
vi.mock(
  "../../../../../src/features/typing/components/result/ResultTags",
  () => ({
    ResultTags: () => null,
  }),
);
vi.mock(
  "../../../../../src/features/typing/components/result/ResultDailyLeaderboard",
  () => ({ ResultDailyLeaderboard: () => null }),
);

import { ResultStats } from "../../../../../src/features/typing/components/result/ResultStats";
import {
  setResultState,
  type ResultStats as ResultStatsType,
} from "../../../../../src/ts/states/result";

function stats(overrides: Partial<ResultStatsType> = {}): ResultStatsType {
  return {
    typingSpeedUnit: "cpm",
    wpm: { text: "507", ariaLabel: "507.28 cpm (101.46 wpm)" },
    raw: { text: "554", ariaLabel: "553.95 cpm (110.79 wpm)" },
    acc: {
      text: "96%",
      ariaLabel: "96.54%\n150 correct\n5 incorrect",
      balloonBreak: true,
    },
    consistency: { text: "79%", ariaLabel: "78.91% (45.67% key)" },
    time: { text: "30s", afk: "9.85% afk", ariaLabel: "30.46s (3s afk 9.85%)" },
    characters: "150/5/2/1",
    testType: ["time 30", "english", "punctuation"],
    other: [],
    source: undefined,
    ...overrides,
  };
}

function renderStats(): HTMLElement {
  const { container } = render(() => <ResultStats />);
  return container;
}

const q = (container: HTMLElement, selector: string): HTMLElement =>
  container.querySelector(selector) as HTMLElement;

describe("ResultStats", () => {
  afterEach(() => {
    cleanup();
    setResultState({ stats: undefined, noStress: false, timeToday: "" });
  });

  it("shows placeholders before the first result", () => {
    const container = renderStats();

    expect(q(container, ".wpm .top .text")).toHaveTextContent("wpm");
    expect(q(container, ".wpm .bottom")).toHaveTextContent("-");
    expect(q(container, ".wpm .bottom")).not.toHaveAttribute("aria-label");
    expect(q(container, ".info")).toHaveClass("hidden");
    expect(q(container, ".source")).toHaveClass("hidden");
  });

  it("renders stats with hover labels", () => {
    setResultState({ stats: stats(), timeToday: "00:01:00 session" });
    const container = renderStats();

    expect(q(container, ".wpm .top .text")).toHaveTextContent("cpm");
    expect(q(container, ".wpm .bottom")).toHaveTextContent("507");
    expect(q(container, ".wpm .bottom")).toHaveAttribute(
      "aria-label",
      "507.28 cpm (101.46 wpm)",
    );
    expect(q(container, ".acc .bottom")).toHaveAttribute(
      "aria-label",
      "96.54%\n150 correct\n5 incorrect",
    );
    expect(q(container, ".acc .bottom")).toHaveAttribute(
      "data-balloon-break",
      "",
    );
    expect(q(container, ".raw .bottom")).toHaveTextContent("554");
    expect(q(container, ".key .bottom")).toHaveTextContent("150/5/2/1");
    expect(q(container, ".consistency .bottom")).toHaveAttribute(
      "aria-label",
      "78.91% (45.67% key)",
    );
    expect(q(container, ".time .bottom .text")).toHaveTextContent("30s");
    expect(q(container, ".time .bottom .afk")).toHaveTextContent("9.85% afk");
    expect(q(container, ".time .bottom .timeToday")).toHaveTextContent(
      "00:01:00 session",
    );
    expect(q(container, ".time .bottom")).toHaveAttribute(
      "aria-label",
      "30.46s (3s afk 9.85%)",
    );
  });

  it("renders test type and other as lines", () => {
    setResultState({
      stats: stats({ other: ["afk detected", "repeated"] }),
    });
    const container = renderStats();

    expect(q(container, ".testType > .bottom").innerHTML).toBe(
      "time 30<br>english<br>punctuation",
    );
    expect(q(container, ".info")).not.toHaveClass("hidden");
    expect(q(container, ".info .bottom").innerHTML).toBe(
      "afk detected<br>repeated",
    );
  });

  it("shows the quote source", () => {
    setResultState({ stats: stats({ source: "a <b>book</b>" }) });
    const container = renderStats();

    expect(q(container, ".source")).not.toHaveClass("hidden");
    expect(q(container, ".source .bottom").textContent).toBe("a <b>book</b>");
  });

  it("drops the balloon break without decimals", () => {
    setResultState({
      stats: stats({
        acc: { text: "96.54%", ariaLabel: "x", balloonBreak: false },
      }),
    });
    const container = renderStats();

    expect(q(container, ".acc .bottom")).not.toHaveAttribute(
      "data-balloon-break",
    );
  });

  it("hides everything in glarses mode", () => {
    setResultState({ stats: stats(), noStress: true });
    const container = renderStats();

    for (const el of container.querySelectorAll(".stats")) {
      expect(el).toHaveClass("hidden");
    }
  });
});
