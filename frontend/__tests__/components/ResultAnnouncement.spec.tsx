import { cleanup, render, screen } from "@solidjs/testing-library";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

import { ResultAnnouncement } from "../../src/features/typing/components/result/ResultAnnouncement";
import { setResultState, type ResultStats } from "../../src/ts/states/result";
import {
  setResultCalculating,
  setResultVisible,
} from "../../src/ts/states/test";

vi.mock("../../src/ts/states/test", async () => {
  const { createSignal } = await import("solid-js");
  const [getResultVisible, setResultVisible] = createSignal(false);
  const [isResultCalculating, setResultCalculating] = createSignal(false);
  return {
    getResultVisible,
    setResultVisible,
    isResultCalculating,
    setResultCalculating,
  };
});

const stats: ResultStats = {
  typingSpeedUnit: "wpm",
  wpm: { text: "80" },
  raw: { text: "85" },
  acc: { text: "95%", balloonBreak: false },
  consistency: { text: "90%" },
  time: { text: "15s", afk: "0", ariaLabel: "15 seconds" },
  characters: "100/0/0/0",
  testType: ["words 15"],
  other: [],
  source: undefined,
};
beforeEach(() => {
  setResultVisible(false);
  setResultCalculating(false);
  setResultState("stats", structuredClone(stats));
  setResultState("noStress", false);
});
afterEach(() => {
  cleanup();
  setResultVisible(false);
});

describe("result announcements", () => {
  it("waits for asynchronously prepared statistics before announcing", () => {
    setResultCalculating(true);
    setResultState("stats", undefined);
    render(() => <ResultAnnouncement />);
    setResultVisible(true);
    expect(screen.getByRole("status").textContent).toBe("");
    setResultState("stats", structuredClone(stats));
    setResultCalculating(false);
    expect(screen.getByRole("status")).toHaveTextContent("80 wpm");
  });

  it("mounts an empty polite atomic region before typing finishes", () => {
    render(() => <ResultAnnouncement />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
    expect(status).toHaveTextContent("");
    setResultState("stats", "wpm", "text", "100");
    expect(status.textContent).toBe("");
  });

  it("announces completed speed, accuracy and elapsed time", () => {
    render(() => <ResultAnnouncement />);
    setResultVisible(true);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Test complete. 80 wpm. Accuracy 95%. Time 15s.",
    );
  });

  it("does not announce live or replay speed ticks", () => {
    render(() => <ResultAnnouncement />);
    setResultVisible(true);
    const initial = screen.getByRole("status").textContent;
    setResultState("stats", "wpm", "text", "120");
    setResultState("stats", "acc", "text", "99%");
    expect(screen.getByRole("status").textContent).toBe(initial);
  });

  it("clears on restart and announces the next completion", () => {
    render(() => <ResultAnnouncement />);
    setResultVisible(true);
    setResultVisible(false);
    expect(screen.getByRole("status").textContent).toBe("");
    setResultState("stats", "wpm", "text", "100");
    setResultVisible(true);
    expect(screen.getByRole("status")).toHaveTextContent("100 wpm");
  });

  it("respects no-stress mode by omitting numeric statistics", () => {
    render(() => <ResultAnnouncement />);
    setResultState("noStress", true);
    setResultVisible(true);
    expect(screen.getByRole("status").textContent).toBe("Test complete.");
  });

  it("stays silent when no completed statistics exist", () => {
    setResultState("stats", undefined);
    render(() => <ResultAnnouncement />);
    setResultVisible(true);
    expect(screen.getByRole("status").textContent).toBe("");
  });
});
