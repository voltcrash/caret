import { render } from "@solidjs/testing-library";
import { expect, it } from "vite-plus/test";

import { CaretWordmark } from "../../../src/components/brand/caret-wordmark";

it("draws the mark before the word and reads as caret", () => {
  const view = render(() => (
    <h1>
      <CaretWordmark />
    </h1>
  ));
  expect(view.getByRole("heading", { name: "caret" })).toBeInTheDocument();
  const wordmark = view.container.querySelector("h1 > span");
  expect(wordmark?.firstElementChild?.tagName.toLowerCase()).toBe("svg");
  expect(wordmark?.firstElementChild).toHaveAttribute("aria-hidden", "true");
  expect(wordmark?.textContent).toBe("caret");
});
