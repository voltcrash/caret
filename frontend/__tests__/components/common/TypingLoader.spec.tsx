import { cleanup, render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, describe, expect, it } from "vite-plus/test";

import {
  LOADER_WORD,
  TypingLoader,
} from "../../../src/ts/components/common/TypingLoader";

describe("TypingLoader", () => {
  afterEach(() => cleanup());

  function parts(container: HTMLElement): {
    root: HTMLElement;
    typed: HTMLElement;
    caret: HTMLElement;
  } {
    const root = container.firstElementChild as HTMLElement;
    return {
      root,
      typed: root.children[0] as HTMLElement,
      caret: root.children[1] as HTMLElement,
    };
  }

  it("loops the typing animation without progress", () => {
    const { container } = render(() => <TypingLoader />);
    const { root, typed, caret } = parts(container);
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root).toHaveTextContent(`${LOADER_WORD}${LOADER_WORD}`);
    expect(typed).toHaveClass("animate-typing-loader-typed");
    expect(caret).toHaveClass("animate-typing-loader-caret");
  });

  it("types one letter per unit of progress", () => {
    const [typedCount, setTypedCount] = createSignal(0);
    const { container } = render(() => <TypingLoader typed={typedCount()} />);
    const { typed, caret } = parts(container);
    expect(typed).not.toHaveClass("animate-typing-loader-typed");
    expect(caret).not.toHaveClass("animate-typing-loader-caret");
    expect(typed.style.width).toBe("0ch");

    setTypedCount(3);
    expect(typed.style.width).toBe("3ch");
    expect(caret.style.transform).toBe("translateX(3ch)");
  });
});
