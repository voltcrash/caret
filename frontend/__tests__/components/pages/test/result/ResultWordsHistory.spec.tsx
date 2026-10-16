import { cleanup, fireEvent, render } from "@solidjs/testing-library";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  destroy: vi.fn(),
  setConfig: vi.fn(),
  burstHistory: [100, 90] as number[],
  inputHistory: ["hxllo ", "world "] as string[],
}));

vi.mock("animejs", () => ({ animate: vi.fn() }));
vi.mock("../../../../../src/ts/config/setters", () => ({
  setConfig: mocks.setConfig,
}));
vi.mock("../../../../../src/ts/hooks/useResultWordHighlight", () => ({
  useResultWordHighlight: () => ({
    component: () => null,
    destroy: mocks.destroy,
  }),
}));
vi.mock("../../../../../src/ts/states/test", () => ({
  getResultVisible: () => true,
  getLastEventLog: () => [],
}));
vi.mock("@oxytype/typing-core/events/stats", () => ({
  getInputHistory: () => mocks.inputHistory,
  getMissedWords: () => ({ hello: 1 }),
  getWordBurstHistory: () => mocks.burstHistory,
}));

import { ResultWordsHistory } from "../../../../../src/features/typing/components/result/ResultWordsHistory";
import { buildWordsHistory } from "../../../../../src/features/typing/runtime/word-markup";
import { setConfigStore } from "../../../../../src/ts/config/store";
import { setResultState } from "../../../../../src/ts/states/result";

const targets = ["hello ", "world ", "foo ", "bar"];

function setItems(): void {
  setResultState(
    "wordsHistory",
    "items",
    buildWordsHistory({
      inputHistory: mocks.inputHistory,
      correctedHistory: ["", ""],
      burstHistory: mocks.burstHistory,
      getTargetWord: (i) => targets[i] ?? "",
      zen: false,
      timed: false,
      korean: false,
    }),
  );
}

function renderHistory(): HTMLElement {
  const { container } = render(() => <ResultWordsHistory />);
  return container;
}

const words = (container: HTMLElement): HTMLElement[] => [
  ...container.querySelectorAll<HTMLElement>(
    "#resultWordsHistory .words .word",
  ),
];

/** `[text, legacy classes]` per letter, like the P0.3 dom baseline. */
const legacyClasses = ["correct", "incorrect", "extra", "corrected"];
const letters = (word: HTMLElement): [string, string][] =>
  [...word.querySelectorAll("letter")].map((l) => [
    l.textContent ?? "",
    [...l.classList].filter((c) => legacyClasses.includes(c)).join(" "),
  ]);

describe("ResultWordsHistory", () => {
  beforeEach(() => {
    setConfigStore("mode", "words");
    setConfigStore("burstHeatmap", false);
    setConfigStore("typingSpeedUnit", "wpm");
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    setResultState("wordsHistory", {
      items: [],
      visible: false,
      slideDuration: 0,
    });
    setResultState({ rightToLeft: false, joiningScript: false });
  });

  it("renders words with legacy classes and attributes", () => {
    setItems();
    const container = renderHistory();
    const list = words(container);

    // input + 2 trailing words are rendered
    expect(list).toHaveLength(4);
    expect(list[0]).toHaveClass("word", "nocursor", "error");
    expect(list[0]?.getAttribute("input")).toBe("hxllo");
    expect(list[0]?.getAttribute("burst")).toBe("100");
    expect(list[1]).toHaveClass("word", "nocursor");
    expect(list[1]).not.toHaveClass("error");
    expect(list[2]).not.toHaveClass("nocursor");
    expect(list[2]?.getAttribute("input")).toBe("");
    expect(list[2]?.hasAttribute("burst")).toBe(false);
    expect(letters(list[0] as HTMLElement)).toEqual([
      ["h", "correct"],
      ["e", "incorrect"],
      ["l", "correct"],
      ["l", "correct"],
      ["o", "correct"],
    ]);
    expect(letters(list[2] as HTMLElement)).toEqual([
      ["f", ""],
      ["o", ""],
      ["o", ""],
    ]);
  });

  it("shows and hides with the store", () => {
    const container = renderHistory();
    const el = container.querySelector("#resultWordsHistory") as HTMLElement;
    expect(el).toHaveClass("hidden");

    setResultState("wordsHistory", { visible: true, slideDuration: 0 });
    expect(el).not.toHaveClass("hidden");

    setResultState("wordsHistory", { visible: false, slideDuration: 0 });
    expect(el).toHaveClass("hidden");
  });

  it("keeps imperative classes on the container", () => {
    const container = renderHistory();
    const el = container.querySelector("#resultWordsHistory") as HTMLElement;
    el.classList.add("noErrorBorder");
    setResultState("wordsHistory", { visible: true, slideDuration: 0 });
    expect(el).toHaveClass("noErrorBorder");
  });

  it("applies right to left and joining script classes", () => {
    const container = renderHistory();
    const wordsEl = container.querySelector(".words") as HTMLElement;
    expect(wordsEl).not.toHaveClass("rightToLeftTest");

    setResultState({ rightToLeft: true, joiningScript: true });
    expect(wordsEl).toHaveClass("rightToLeftTest", "joiningScript");
  });

  it("shows typed input and speed on hover", () => {
    setItems();
    const container = renderHistory();
    const [first, , third] = words(container);

    fireEvent.mouseEnter(first as HTMLElement);
    const highlight = first?.querySelector(".wordInputHighlight");
    expect(highlight?.querySelector(".text")).toHaveTextContent("hxllo");
    expect(highlight?.querySelector(".speed")).toHaveTextContent("100 wpm");

    fireEvent.mouseLeave(first as HTMLElement);
    expect(first?.querySelector(".wordInputHighlight")).toBeNull();

    // untyped words have no input to show
    fireEvent.mouseEnter(third as HTMLElement);
    expect(third?.querySelector(".wordInputHighlight")).toBeNull();
  });

  it("renders the burst heatmap when enabled", () => {
    setItems();
    const container = renderHistory();
    const legend = container.querySelector(".heatmapLegend") as HTMLElement;
    expect(legend).toHaveClass("hidden");
    expect(words(container)[0]?.style.color).toBe("");

    setConfigStore("burstHeatmap", true);

    expect(legend).not.toHaveClass("hidden");
    expect(legend.querySelector(".box0")).toHaveTextContent("<90");
    expect(legend.querySelector(".box4")).toHaveTextContent("100+");
    expect(words(container)[0]).toHaveClass("heatmapInherit");
    expect(words(container)[0]?.style.color).not.toBe("");
    // untyped words get the unreached color without inheriting
    expect(words(container)[2]).not.toHaveClass("heatmapInherit");
    expect(words(container)[2]?.style.color).not.toBe("");
  });

  it("toggles the burst heatmap", () => {
    const container = renderHistory();
    fireEvent.click(
      container.querySelector("#toggleBurstHeatmap") as HTMLElement,
    );
    expect(mocks.setConfig).toHaveBeenCalledWith("burstHeatmap", true);
    expect(mocks.destroy).toHaveBeenCalled();
  });

  it("copies the words list", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const container = renderHistory();

    fireEvent.click(
      container.querySelector("#copyMissedWordsListButton") as HTMLElement,
    );
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("hello"));
  });
});
