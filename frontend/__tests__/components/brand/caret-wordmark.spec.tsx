import { render } from "@solidjs/testing-library";
import { expect, it } from "vite-plus/test";

import { CaretWordmark } from "../../../src/components/brand/caret-wordmark";

it("draws the mark as the t and reads as caret", () => {
  const view = render(() => (
    <h1>
      <CaretWordmark />
    </h1>
  ));
  expect(view.getByRole("heading", { name: "caret" })).toBeInTheDocument();
  const visual = view.container.querySelector('[aria-hidden="true"]');
  expect(visual?.textContent).toBe("care");
  expect(visual?.lastElementChild?.tagName.toLowerCase()).toBe("svg");
});
