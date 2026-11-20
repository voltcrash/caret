import { JSXElement } from "solid-js";

import { Button } from "#shared/components/common/Button.tsx";
import { getConfig } from "#shared/config/store.ts";
import { focusInputElement } from "#shared/input/input-element.ts";
import {
  getFocus,
  isResultCalculating,
  isTestActive,
} from "#shared/states/test.ts";
import { cn } from "#shared/utils/cn.ts";
import { isCoarsePointer } from "#shared/utils/pointer.ts";

import * as TestLogic from "../runtime/test/logic";

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
