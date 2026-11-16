import { createRoot } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const logging = vi.hoisted(() => ({ enabled: false }));
vi.mock("../../../src/ts/utils/logger", () => ({
  isDebugLogging: () => logging.enabled,
}));
vi.mock("../../../src/ts/input/handlers/keydown", () => ({
  onKeydown: vi.fn(),
}));
vi.mock("../../../src/ts/input/handlers/keyup", () => ({ onKeyup: vi.fn() }));

import { bindKeyListeners } from "../../../src/ts/input/listeners/key";
import { bindMiscListeners } from "../../../src/ts/input/listeners/misc";

afterEach(() => {
  logging.enabled = false;
  vi.restoreAllMocks();
});

function bind(): { input: HTMLTextAreaElement; dispose: () => void } {
  const input = document.createElement("textarea");
  const dispose = createRoot((dispose) => {
    bindKeyListeners(input);
    return dispose;
  });
  return { input, dispose };
}

describe("typing input debug logs", () => {
  it("skips per-key debug payloads unless debug logging is on", () => {
    const debug = vi
      .spyOn(console, "debug")
      .mockImplementation(() => undefined);
    const { input, dispose } = bind();
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    input.dispatchEvent(new KeyboardEvent("keyup", { key: "a" }));
    expect(debug).not.toHaveBeenCalled();
    logging.enabled = true;
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "b" }));
    expect(debug).toHaveBeenCalledWith(
      "wordsInput event keydown",
      expect.objectContaining({ key: "b" }),
    );
    dispose();
  });

  it("serializes the document selection only when debug logging is on", () => {
    const selection = vi.spyOn(window, "getSelection");
    const input = document.createElement("textarea");
    document.body.append(input);
    const dispose = createRoot((dispose) => {
      bindMiscListeners(input);
      return dispose;
    });
    input.dispatchEvent(new Event("selectionchange"));
    expect(selection).not.toHaveBeenCalled();
    logging.enabled = true;
    vi.spyOn(console, "debug").mockImplementation(() => undefined);
    input.dispatchEvent(new Event("selectionchange"));
    expect(selection).toHaveBeenCalledOnce();
    dispose();
    input.remove();
  });
});
