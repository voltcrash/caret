import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, expect, it } from "vite-plus/test";

import { PrivacyPolicy } from "../../../src/ts/components/standalone/PrivacyPolicy";

afterEach(cleanup);

it("shows Caret's data policy and its own contact destination", () => {
  const { container } = render(() => <PrivacyPolicy />);
  expect(container).toHaveTextContent(
    "Caret is an independent, open-source typing test",
  );
  expect(container).toHaveTextContent("Neon");
  expect(container).toHaveTextContent("90 days");
  expect(container.querySelector("main h1")).toHaveTextContent(
    "Privacy Policy",
  );
  expect(container.querySelector("main a")).toHaveAttribute(
    "href",
    "https://github.com/voltcrash/caret/discussions",
  );
  expect(container.querySelector('a[href="#opt-out"]')).toBeNull();
  expect(container.querySelector('a[href*="monkeytype.com"]')).toBeNull();
});
