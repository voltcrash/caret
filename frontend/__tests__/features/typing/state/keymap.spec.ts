import { expect, it } from "vite-plus/test";

import { setConfigStore } from "../../../../src/ts/config/store";
import {
  flash,
  getKeymapFlashState,
  getKeymapHighlightKey,
  highlight,
} from "../../../../src/features/typing/state/keymap";

it("highlights the next key and flashes typed keys in react mode", () => {
  setConfigStore("keymapMode", "react");

  highlight("");
  expect(getKeymapHighlightKey()).toBe(" ");

  flash("a", false);
  flash("a");
  expect(getKeymapHighlightKey()).toBeUndefined();
  expect(getKeymapFlashState["a"]).toEqual({ tick: 2, correct: true });
});
