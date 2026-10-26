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
  // CSS draws "care" so axe sees no partial word beside link names.
  expect(visual?.textContent).toBe("");
  expect(visual?.classList).toContain("before:content-['care']");
  expect(visual?.lastElementChild?.tagName.toLowerCase()).toBe("svg");
});
