import { JSXElement, Show } from "solid-js";

import { setBailedOut } from "#features/typing/state/run-flags.ts";
import { Button } from "#shared/components/common/Button.tsx";
import { getConfig } from "#shared/config/store.ts";
import { getCustomTextIndicator } from "#shared/states/core.ts";
import { isTestActive } from "#shared/states/test.ts";

import * as TestLogic from "../runtime/test/logic";

// Touch-only equivalent of shift+enter saving progress on a long custom text.
// shift+enter bails out of long custom texts; saving progress is bailing out.
export function SaveProgressButton(): JSXElement {
  return (
    <Show
      when={
        getConfig.mode === "custom" &&
        getCustomTextIndicator()?.isLong === true &&
        isTestActive()
      }
    >
      <Button
        id="saveProgressButton"
        variant="text"
        class="col-[content] mx-auto mt-4 hidden px-[2em] py-[1em] text-[1rem] pointer-coarse:flex pointer-coarse:min-h-11 pointer-coarse:min-w-11"
        text="save progress"
        fa={{ icon: "fa-save", fixedWidth: true }}
        onClick={() => {
          setBailedOut(true);
          void TestLogic.finish();
        }}
      />
    </Show>
  );
}
