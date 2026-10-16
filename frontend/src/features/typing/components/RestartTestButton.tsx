import { JSXElement } from "solid-js";

import { Button } from "../../../ts/components/common/Button";
import { getConfig } from "../../../ts/config/store";
import { focusInputElement } from "../../../ts/input/input-element";
import {
  getFocus,
  isResultCalculating,
  isTestActive,
} from "../../../ts/states/test";
import { cn } from "../../../ts/utils/cn";
import { isCoarsePointer } from "../../../ts/utils/pointer";
import * as TestLogic from "../runtime/test-logic";

export function RestartTestButton(): JSXElement {
  const onClick = (): void => {
    if (isResultCalculating()) return;
    // Focus inside the tap gesture so the on-screen keyboard can stay up across restart.
    if (isCoarsePointer()) {
      focusInputElement(true);
    }
    if (
      isTestActive() &&
      getConfig.repeatQuotes === "typing" &&
      getConfig.mode === "quote"
    ) {
      void TestLogic.restart({
        withSameWordset: true,
      });
    } else {
      void TestLogic.restart();
    }
  };

  return (
    <Button
      id="restartTestButton"
      variant="text"
      class={cn(
        "col-[content] mx-auto mt-4 flex px-[2em] py-[1em] text-[1rem] pointer-coarse:min-h-11 pointer-coarse:min-w-11",
        getConfig.quickRestart !== "off" && "hidden",
        "pointer-coarse:max-[778px]:block!",
        getFocus() &&
          "opacity-0! focus-visible:opacity-100! pointer-coarse:opacity-50!",
      )}
      balloon={{ text: "Restart Test", position: "down" }}
      fa={{ icon: "fa-redo-alt", fixedWidth: true }}
      onClick={onClick}
    />
  );
}
