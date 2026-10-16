import { JSXElement, Show } from "solid-js";

import * as TestLogic from "../../../../features/typing/runtime/test-logic";
import { getTestInitError } from "../../../states/test";
import { cn } from "../../../utils/cn";
import { Button } from "../../common/Button";

export function TestInitFailed(): JSXElement {
  return (
    <div
      id="testInitFailed"
      class={cn(
        "content-grid col-[content] mt-8 text-center text-[1rem]",
        getTestInitError() === null && "hidden",
      )}
    >
      <div class="max-w-[800px] justify-self-center [grid-area:content]">
        <div>
          Test initialization failed. Please try different settings or
          refreshing the page. If the problem persists, please contact support.
        </div>
        <Show when={getTestInitError()?.message}>
          {(message) => <div class="mt-8">{message()}</div>}
        </Show>
        <Button
          class="mt-8 px-8 py-4"
          active
          fa={{ icon: "fa-redo-alt", fixedWidth: true }}
          text="Restart"
          onClick={() => void TestLogic.restart()}
        />
      </div>
    </div>
  );
}
