import { cleanup, render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, expect, it } from "vite-plus/test";

import { HighlightedText } from "../../../src/ts/components/common/HighlightedText";

afterEach(cleanup);

it.each(["<script>alert(1)</script>", '<img src="x" onerror="alert(1)">'])(
  "renders highlighted and unmatched input as text: %s",
  (input) => {
    const [matches, setMatches] = createSignal<string[]>([]);
    const view = render(() => (
      <HighlightedText text={input} matches={matches()} />
    ));
    expect(view.container.textContent).toBe(input);
    expect(view.container.querySelector("script, img")).toBeNull();
    setMatches([input]);
    expect(view.container.textContent).toBe(input);
    expect(view.container.querySelector("script, img")).toBeNull();
    expect(view.container.querySelector(".highlight")?.textContent).toBe(input);
  },
);

it("highlights literal regex punctuation without changing the text", () => {
  const view = render(() => (
    <HighlightedText
      text="C++ (a|b) & <tag>"
      matches={["C++", "(a|b)", "<tag>"]}
    />
  ));
  expect(view.container.textContent).toBe("C++ (a|b) & <tag>");
  expect(
    [...view.container.querySelectorAll(".highlight")].map(
      (el) => el.textContent,
    ),
  ).toEqual(["C++", "(a|b)", "<tag>"]);
  expect(view.container.querySelector("tag")).toBeNull();
});
