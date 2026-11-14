import { render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { expect, it } from "vite-plus/test";

import { Fa } from "../../../src/ts/components/common/Fa";
import { icons } from "../../../src/ts/icons";

it("renders SVG immediately and updates data-selected icons and variants", () => {
  const [regular, setRegular] = createSignal(false);
  const { container } = render(() => (
    <Fa
      icon="fa-star"
      variant={regular() ? "regular" : "solid"}
      fixedWidth
      spin
      size={2}
      class="test-icon"
    />
  ));
  const wrapper = container.querySelector("i");
  expect(wrapper).toHaveClass("fas", "fa-fw", "fa-spin", "test-icon");
  expect(wrapper?.style.fontSize).toBe("2em");
  expect(container.querySelector("path")?.getAttribute("d")).toBe(
    icons.solid["fa-star"].path,
  );
  expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  setRegular(true);
  expect(wrapper).toHaveClass("far");
  expect(container.querySelector("path")?.getAttribute("d")).toBe(
    icons.regular["fa-star"].path,
  );
});

it("renders brand icons and keeps an HTMLElement for cached word icons", () => {
  const { container } = render(() => <Fa icon="fa-github" variant="brand" />);
  expect(container.firstElementChild).toBeInstanceOf(HTMLElement);
  expect(container.querySelector("path")?.getAttribute("d")).toBe(
    icons.brand["fa-github"].path,
  );
});
