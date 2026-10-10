import { JSXElement } from "solid-js";

import { getConfig } from "../../../config/store";
import {
  getFocus,
  isResultCalculating,
  isTestActive,
} from "../../../states/test";
import * as TestLogic from "../../../test/test-logic";
import { cn } from "../../../utils/cn";
import { Button } from "../../common/Button";

export function RestartTestButton(): JSXElement {
  const onClick = (): void => {
    if (isResultCalculating()) return;
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
