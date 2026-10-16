import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { Notice } from "../../../../../src/features/typing/components/modes-notice/Notice";

describe("Notice", () => {
  afterEach(() => {
    cleanup();
  });

  it("does not stretch button notices to the wrapped row height", () => {
    const { getByRole } = render(() => (
      <Notice
        when={true}
        icon="fa-hand-paper"
        onClick={() => undefined}
        class="text-error"
        text="stop on word"
      />
    ));

    const button = getByRole("button", { name: "stop on word" });
    expect(button).not.toHaveClass("h-full");
    expect(button).toHaveClass("text-error");
  });

  it("renders nothing when hidden", () => {
    const { container } = render(() => (
      <Notice when={false} text="opposite shift" />
    ));

    expect(container).toBeEmptyDOMElement();
  });
});
