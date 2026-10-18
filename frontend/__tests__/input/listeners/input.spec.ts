import { createRoot } from "solid-js";
import { expect, it, vi } from "vite-plus/test";
import { bindInputListeners } from "../../../src/ts/input/listeners/input";
import { onBeforeInsertText } from "../../../src/ts/input/handlers/before-insert-text";

vi.mock("../../../src/ts/input/handlers/before-insert-text", () => ({
  onBeforeInsertText: vi.fn(() => false),
}));
vi.mock("../../../src/ts/input/handlers/insert-text", () => ({
  onInsertText: vi.fn(),
}));
vi.mock("../../../src/ts/input/handlers/delete", () => ({ onDelete: vi.fn() }));
vi.mock("../../../src/ts/input/handlers/before-delete", () => ({
  onBeforeDelete: vi.fn(),
}));
vi.mock("../../../src/features/typing/runtime/test-ui", () => ({}));
vi.mock("../../../src/features/typing/runtime/test-words", () => ({}));
vi.mock("../../../src/features/typing/runtime/words-generator", () => ({}));

it("cancels unexpected events while accepting browser beforeinput events", () => {
  const input = document.createElement("textarea");
  const dispose = createRoot((dispose) => {
    bindInputListeners(input);
    return dispose;
  });
  for (const type of ["beforeinput", "input"]) {
    const event = new Event(type, { cancelable: true });
    input.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  }
  input.dispatchEvent(
    new InputEvent("beforeinput", {
      data: "a",
      inputType: "insertText",
      cancelable: true,
    }),
  );
  expect(onBeforeInsertText).toHaveBeenCalledExactlyOnceWith("a");
  dispose();
});
