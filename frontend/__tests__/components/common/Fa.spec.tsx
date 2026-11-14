import "../../../src/app/app.css";
import { render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { expect, it } from "vite-plus/test";

import { icons } from "../../../src/components/icons/data";
import { Fa, type FaProps } from "../../../src/ts/components/common/Fa";

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
  if (!(wrapper instanceof HTMLElement)) throw new Error("Missing icon");
  const fontSize = Number.parseFloat(getComputedStyle(wrapper).fontSize);
  expect(Number.parseFloat(getComputedStyle(wrapper).width)).toBeCloseTo(
    fontSize * 1.25,
    1,
  );
  expect(getComputedStyle(wrapper).animationDuration).toBe("2s");
  expect(getComputedStyle(wrapper).fontFamily).not.toContain("Font Awesome");
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

it("renders checkbox marks with the owned SVG mask", () => {
  const { container } = render(() => <input type="checkbox" checked />);
  const checkbox = container.querySelector("input");
  if (!checkbox) throw new Error("Missing checkbox");
  const style = getComputedStyle(checkbox, "::after");
  expect(style.maskImage).toContain("svg");
  expect(style.color).not.toBe("rgba(0, 0, 0, 0)");
  expect(style.fontFamily).not.toContain("Font Awesome");
});

it.each(["fas fa-exclamation-triangle", "fa fa-fw fa-bullhorn"])(
  "renders legacy banner class strings: %s",
  (icon) => {
    const { container } = render(() => <Fa {...({ icon } as FaProps)} />);
    expect(container.querySelector("path")?.getAttribute("d")).toBeTruthy();
  },
);

it("preserves the button icon line height override", () => {
  const { container } = render(() => (
    <button>
      <Fa icon="fa-crown" />
    </button>
  ));
  const icon = container.querySelector("i");
  if (!icon) throw new Error("Missing icon");
  const style = getComputedStyle(icon);
  expect(Number.parseFloat(style.lineHeight)).toBeCloseTo(
    Number.parseFloat(style.fontSize) * 1.25,
  );
});
