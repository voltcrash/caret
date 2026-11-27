import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, expect, it } from "vite-plus/test";

import { StandaloneHeader } from "../../../src/ts/components/standalone/StandaloneHeader";

afterEach(cleanup);

it("links home with a focusable document link instead of a header click", () => {
  const { container } = render(() => <StandaloneHeader label="Sign in" />);
  const logo = container.querySelector("#logo");
  expect(logo?.localName).toBe("a");
  expect(logo).toHaveAttribute("href", "/");
  expect(logo).not.toHaveAttribute("router-link");
  expect(logo).toHaveTextContent("Sign in");
});
