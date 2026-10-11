import { JSXElement, Show } from "solid-js";

import { getConfig } from "../../../config/store";
import { isTestActive } from "../../../states/test";
import * as TestLogic from "../../../test/test-logic";
import { Button } from "../../common/Button";

// Touch-only equivalent of shift+enter finishing a zen test.
export function FinishZenButton(): JSXElement {
  return (
    <Show when={getConfig.mode === "zen" && isTestActive()}>
      <Button
        id="finishZenButton"
        variant="text"
        class="col-[content] mx-auto mt-4 hidden px-[2em] py-[1em] text-[1rem] pointer-coarse:flex pointer-coarse:min-h-11 pointer-coarse:min-w-11"
        text="finish"
        fa={{ icon: "fa-check", fixedWidth: true }}
        onClick={() => void TestLogic.finish()}
      />
    </Show>
  );
}
