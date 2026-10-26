import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, expect, it } from "vite-plus/test";

import { PrivacyPolicy } from "../../../src/ts/components/standalone/PrivacyPolicy";

afterEach(cleanup);

it("shows Caret's policy placeholder and its own contact destination", () => {
  const { container } = render(() => <PrivacyPolicy />);
  expect(container).toHaveTextContent(
    "Caret is preparing a privacy policy for its own hosting and services",
  );
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
