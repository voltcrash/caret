import type { EventLog } from "@oxytype/typing-core/events/types";

import { cleanup, fireEvent, render } from "@solidjs/testing-library";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

type Input = {
  wordIndex: number;
  inputType: string;
  data?: string;
  correct?: boolean;
  inputValue?: string;
};

const mocks = vi.hoisted(() => ({
  events: [] as { type: "input"; testMs: number; data: Input }[],
  inputForWord: "ab ",
}));

vi.mock("animejs", () => ({ animate: vi.fn() }));
vi.mock("../../../../../src/ts/controllers/sound-controller", () => ({
  playClick: vi.fn(),
  playError: vi.fn(),
}));
vi.mock("../../../../../src/features/typing/runtime/events/data", async () => {
  const { getReplaySteps } = await import("@oxytype/typing-core/replay");
  const targetWords = ["ab ", "cd"];
  return {
    buildEventLog: () => [],
    getTestSession: (() => {
      const session = {
        getReplay: () => ({
          words: targetWords,
          steps: getReplaySteps(
            { context: { targetWords }, events: mocks.events } as EventLog,
            false,
          ),
        }),
      };
      return () => session;
    })(),
  };
});
vi.mock("@oxytype/typing-core/events/helpers", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@oxytype/typing-core/events/helpers")
  >()),
  getInputFromDom: () => mocks.inputForWord,
}));
vi.mock("@oxytype/typing-core/events/stats", () => ({
  getInputHistory: () => [],
  getWpmHistory: () => [60, 70],
}));

import { ResultReplay } from "../../../../../src/features/typing/components/result/ResultReplay";
import {
  pauseReplay,
  toggleReplayDisplay,
} from "../../../../../src/features/typing/runtime/replay";
import { setResultState } from "../../../../../src/ts/states/result";

function input(testMs: number, data: Input): (typeof mocks.events)[number] {
  return { type: "input", testMs, data };
}

// a, x (wrong), backspace, b, space, c, d
const events = [
  input(0, { wordIndex: 0, inputType: "insertText", data: "a", correct: true }),
  input(100, {
    wordIndex: 0,
    inputType: "insertText",
    data: "x",
    correct: false,
  }),
  input(200, {
    wordIndex: 0,
    inputType: "deleteContentBackward",
    inputValue: "a",
  }),
  input(300, {
    wordIndex: 0,
    inputType: "insertText",
    data: "b",
    correct: true,
  }),
  input(400, {
    wordIndex: 0,
    inputType: "insertText",
    data: " ",
    correct: true,
  }),
  input(1200, {
    wordIndex: 1,
    inputType: "insertText",
    data: "c",
    correct: true,
  }),
  input(1300, {
    wordIndex: 1,
    inputType: "insertText",
    data: "d",
    correct: true,
  }),
];

function openReplay(): void {
  toggleReplayDisplay();
}

const button = (c: HTMLElement): HTMLElement =>
  c.querySelector("#playpauseReplayButton") as HTMLElement;

const words = (c: HTMLElement): string[][] =>
  [...c.querySelectorAll("#replayWords .word")].map((w) =>
    [...w.querySelectorAll("letter")].map(
      (l) =>
        `${l.textContent}:${[...l.classList].filter((x) => ["correct", "incorrect", "extra"].includes(x)).join(".")}`,
    ),
  );

describe("ResultReplay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.events = events;
    mocks.inputForWord = "ab ";
  });

  afterEach(() => {
    pauseReplay();
    cleanup();
    vi.useRealTimers();
    setResultState("replay", {
      visible: false,
      slideDuration: 0,
      playback: "start",
      stats: "0s",
      words: [],
    });
  });

  it("plays the replay into the words", async () => {
    const { container } = render(() => <ResultReplay />);
    openReplay();
    expect(button(container)).toHaveAttribute("aria-label", "Start replay");

    fireEvent.click(button(container));
    expect(button(container)).toHaveAttribute("aria-label", "Pause replay");
    expect(button(container).querySelector("i")).toHaveClass("fa-pause");

    await vi.advanceTimersByTimeAsync(150);
    expect(words(container)[0]).toEqual(["a:correct", "b:incorrect", " :"]);

    await vi.advanceTimersByTimeAsync(1200);
    expect(words(container)).toEqual([
      ["a:correct", "b:correct", " :correct"],
      ["c:correct", "d:correct"],
    ]);
    expect(container.querySelector("#replayStats")).toHaveTextContent(
      "60wpm 1s",
    );
    expect(button(container)).toHaveAttribute("aria-label", "Start replay");
  });

  it("pauses and resumes", async () => {
    const { container } = render(() => <ResultReplay />);
    openReplay();
    fireEvent.click(button(container));
    await vi.advanceTimersByTimeAsync(50);
    fireEvent.click(button(container));
    expect(button(container)).toHaveAttribute("aria-label", "Resume replay");
    expect(button(container).querySelector("i")).toHaveClass("fa-play");

    await vi.advanceTimersByTimeAsync(2000);
    expect(words(container)[0]).toEqual(["a:correct", "b:", " :"]);

    fireEvent.click(button(container));
    await vi.advanceTimersByTimeAsync(2000);
    expect(words(container)[1]).toEqual(["c:correct", "d:correct"]);
  });

  it("jumps to a clicked letter", async () => {
    const { container } = render(() => <ResultReplay />);
    openReplay();
    fireEvent.click(button(container));
    await vi.advanceTimersByTimeAsync(2000);

    const letter = container.querySelectorAll("#replayWords .word")[0]
      ?.children[1] as HTMLElement;
    fireEvent.click(letter);
    expect(button(container)).toHaveAttribute("aria-label", "Resume replay");
    // replayed up to the second letter of the first word
    expect(words(container)[0]).toEqual(["a:correct", "b:", " :"]);
  });

  it("marks extra letters and error words", async () => {
    mocks.events = [
      input(0, {
        wordIndex: 0,
        inputType: "insertText",
        data: "a",
        correct: true,
      }),
      input(10, {
        wordIndex: 0,
        inputType: "insertText",
        data: "b",
        correct: true,
      }),
      input(20, {
        wordIndex: 0,
        inputType: "insertText",
        data: " ",
        correct: true,
      }),
      input(30, {
        wordIndex: 0,
        inputType: "insertText",
        data: "z",
        correct: false,
      }),
      input(40, {
        wordIndex: 1,
        inputType: "insertText",
        data: "c",
        correct: true,
      }),
    ];
    mocks.inputForWord = "ab z";
    const { container } = render(() => <ResultReplay />);
    openReplay();
    fireEvent.click(button(container));
    await vi.advanceTimersByTimeAsync(100);
    expect(container.querySelectorAll("#replayWords .word")[0]).toHaveClass(
      "error",
    );
    expect(words(container)[0]).toEqual([
      "a:correct",
      "b:correct",
      " :correct",
      "z:incorrect.extra",
    ]);
  });
});
