import { cleanup, render } from "@solidjs/testing-library";
import { onMount } from "solid-js";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import "../../src/app/app.css";
import { AnimatedModal } from "../../src/ts/components/common/AnimatedModal";
import { useInputListener } from "../../src/ts/hooks/useInputListener";
import { useWordsInputScroll } from "../../src/ts/hooks/useWordsInputScroll";
import {
  hideModal,
  hideModalAndClearChain,
  showModal,
} from "../../src/ts/states/modals";
import { centerWordsInputEvent } from "../../src/ts/states/words-layout";

afterEach(() => {
  cleanup();
  hideModalAndClearChain("QuoteRate");
  window.scrollTo({ top: 0, behavior: "instant" });
});

it("opens a native modal, traps Tab and returns focus after Escape", async () => {
  render(() => (
    <>
      <button type="button" onClick={() => showModal("QuoteRate")}>
        Open browser modal
      </button>
      <AnimatedModal
        id="QuoteRate"
        title="Browser focus"
        animationMode="none"
        focusFirstInput
      >
        <input aria-label="Browser modal name" />
        <button type="button" disabled>
          Disabled
        </button>
        <button type="button" onClick={() => hideModal("QuoteRate")}>
          Close browser modal
        </button>
      </AnimatedModal>
    </>
  ));
  const trigger = page.getByRole("button", { name: "Open browser modal" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Browser focus" });
  await expect.poll(() => dialog.element().matches(":modal")).toBe(true);
  const input = page.getByRole("textbox", { name: "Browser modal name" });
  await expect.poll(() => input.element()).toHaveFocus();
  await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
  await expect
    .poll(() =>
      page.getByRole("button", { name: "Close browser modal" }).element(),
    )
    .toHaveFocus();
  await userEvent.keyboard("{Tab}");
  await expect.poll(() => input.element()).toHaveFocus();
  await userEvent.keyboard("{Escape}");
  await expect.poll(() => trigger.element()).toHaveFocus();
  expect(document.querySelector("dialog[open]")).toBeNull();
});

it("handles real textarea keystrokes and removes its listener on disposal", async () => {
  const handler = vi.fn();
  let input!: HTMLTextAreaElement;
  const view = render(() => {
    onMount(() => useInputListener(input, "keydown", handler));
    return (
      <textarea
        ref={(element) => (input = element)}
        aria-label="Browser typing input"
      />
    );
  });
  const field = page.getByRole("textbox", { name: "Browser typing input" });
  await field.click();
  await userEvent.keyboard("ab{Backspace}c");
  await expect.poll(() => field.element()).toHaveValue("ac");
  expect(handler).toHaveBeenCalledTimes(4);
  expect(
    handler.mock.calls.every(([event]) => (event as KeyboardEvent).isTrusted),
  ).toBe(true);
  view.unmount();
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "d" }));
  expect(handler).toHaveBeenCalledTimes(4);
});

it("centers the real typing input when its wrapper exceeds the viewport", async () => {
  let wrapper!: HTMLDivElement;
  let input!: HTMLTextAreaElement;
  render(() => {
    onMount(() => useWordsInputScroll(wrapper, input));
    return (
      <div
        ref={(element) => (wrapper = element)}
        style={{ height: `${window.innerHeight * 3}px` }}
      >
        <div style={{ height: `${window.innerHeight * 1.5}px` }} />
        <textarea
          ref={(element) => (input = element)}
          aria-label="Scroll target"
        />
      </div>
    );
  });
  expect(input.getBoundingClientRect().top).toBeGreaterThan(window.innerHeight);
  centerWordsInputEvent.dispatch(false);
  const padding = getComputedStyle(document.documentElement);
  const center =
    (window.innerHeight +
      (parseFloat(padding.scrollPaddingTop) || 0) -
      (parseFloat(padding.scrollPaddingBottom) || 0)) /
    2;
  await expect
    .poll(() => {
      const rect = input.getBoundingClientRect();
      return Math.abs(rect.top + rect.height / 2 - center);
    })
    .toBeLessThan(2);
  expect(window.scrollY).toBeGreaterThan(0);
});

it("leaves the page still when the typing wrapper fits the viewport", () => {
  let wrapper!: HTMLDivElement;
  let input!: HTMLTextAreaElement;
  render(() => {
    onMount(() => useWordsInputScroll(wrapper, input));
    return (
      <div ref={(element) => (wrapper = element)}>
        <textarea ref={(element) => (input = element)} />
      </div>
    );
  });
  centerWordsInputEvent.dispatch(true);
  expect(window.scrollY).toBe(0);
});
