import { EngineFailure } from "@caret/typing-engine/failure";
import { JSXElement, Show } from "solid-js";

import { Button } from "../../../ts/components/common/Button";
import { getTestInitError } from "../../../ts/states/test";
import { cn } from "../../../ts/utils/cn";
import { getBrowserEngine } from "../engine.client";
import * as TestLogic from "../runtime/test-logic";

export function TestInitFailed(): JSXElement {
  const crashed = (): boolean => {
    const status = getBrowserEngine().status();
    return (
      status.state === "failed" &&
      status.error instanceof EngineFailure &&
      status.error.code === "internal"
    );
  };
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
          text={crashed() ? "Reload typing engine" : "Restart"}
          onClick={() =>
            crashed() ? window.location.reload() : void TestLogic.restart()
          }
        />
      </div>
    </div>
  );
}
