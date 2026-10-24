import { cleanup, render } from "@solidjs/testing-library";
import { JSXElement } from "solid-js";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

vi.mock("../../src/ts/states/test", () => ({
  isLanguageRightToLeft: () => false,
}));

import { useRef } from "../../src/ts/hooks/useRef";
import { useResultWordHighlight } from "../../src/ts/hooks/useResultWordHighlight";
import {
  resultWordHighlightEvent,
  setResultState,
} from "../../src/ts/states/result";

let destroyHighlight: () => void;

function Harness(): JSXElement {
  const [ref, element] = useRef<HTMLDivElement>();
  const highlight = useResultWordHighlight(element);
  destroyHighlight = highlight.destroy;
  return (
    <div id="resultWordsHistory" ref={ref}>
      <div class="words">
        <div class="word" attr:input="hxllo">
          <letter>h</letter>
          <letter>e</letter>
          <letter>l</letter>
          <letter>l</letter>
          <letter>o</letter>
        </div>
        <div class="word" attr:input={"a\tb\nc_extra"}>
          <letter>a</letter>
          <letter>b</letter>
          <letter>c</letter>
        </div>
        <div class="word" attr:input="">
          <letter>x</letter>
        </div>
      </div>
      {highlight.component()}
    </div>
  );
}

async function highlight(first: number, last: number): Promise<void> {
  resultWordHighlightEvent.dispatch({
    type: "highlight",
    firstWordIndex: first,
    lastWordIndex: last,
  });
  // init waits for the words history toggle buffer
  await vi.advanceTimersByTimeAsync(300);
}

const highlightEls = (c: HTMLElement): HTMLElement[] => [
  ...c.querySelectorAll<HTMLElement>(".highlightContainer .highlight"),
];

describe("useResultWordHighlight", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    resultWordHighlightEvent.dispatch({ type: "hoverChart", hovering: false });
    cleanup();
    vi.useRealTimers();
  });

  it("does nothing while the chart is not hovered", async () => {
    const { container } = render(() => <Harness />);
    await highlight(0, 1);
    expect(container.querySelector(".highlightContainer")).toBeNull();
  });

  it("renders typed input over the hovered words", async () => {
    const { container } = render(() => <Harness />);
    resultWordHighlightEvent.dispatch({ type: "hoverChart", hovering: true });
    await highlight(0, 1);

    // Each block word has its own measured line in a real browser.
    expect(container.querySelectorAll(".highlightContainer")).toHaveLength(3);
    expect(
      [...container.querySelectorAll(".inputWord")].map((w) => w.textContent),
    ).toEqual(["hxllo", "a_b"]);
    const [el] = highlightEls(container);
    expect(el).not.toHaveClass("highlight-hidden");
    expect(el).not.toHaveClass("withAnimation");

    await highlight(1, 1);
    expect(highlightEls(container)[0]).toHaveClass("withAnimation");
  });

  it("hides the highlight when the chart is left", async () => {
    const { container } = render(() => <Harness />);
    resultWordHighlightEvent.dispatch({ type: "hoverChart", hovering: true });
    await highlight(0, 0);
    resultWordHighlightEvent.dispatch({ type: "hoverChart", hovering: false });
    expect(highlightEls(container)[0]).toHaveClass("highlight-hidden");
  });

  it("is destroyed on demand, on resize and with a new result", async () => {
    const { container } = render(() => <Harness />);
    resultWordHighlightEvent.dispatch({ type: "hoverChart", hovering: true });

    await highlight(0, 0);
    destroyHighlight();
    expect(container.querySelector(".highlightContainer")).toBeNull();

    await highlight(0, 1);
    window.dispatchEvent(new Event("resize"));
    expect(container.querySelector(".highlightContainer")).toBeNull();

    await highlight(0, 0);
    setResultState("wordsHistory", "items", []);
    expect(container.querySelector(".highlightContainer")).toBeNull();
  });
});
