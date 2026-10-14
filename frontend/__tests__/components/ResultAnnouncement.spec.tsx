import { cleanup, render, screen } from "@solidjs/testing-library";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

import { ResultAnnouncement } from "../../src/ts/components/pages/test/result/ResultAnnouncement";
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
});
