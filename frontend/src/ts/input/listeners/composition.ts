import { useInputListener } from "../../hooks/useInputListener";
import * as CompositionState from "../../states/composition";
import * as TestLogic from "../../../features/typing/runtime/test-logic";
import { setLastInsertCompositionTextData } from "../state";
import { onInsertText } from "../handlers/insert-text";
import { logTestEvent } from "../../../features/typing/runtime/events/data";
import {
  isTestRestarting,
  getActiveWordIndex,
  isResultCalculating,
  isTestActive,
  setCompositionText,
} from "../../states/test";

export function bindCompositionListeners(inputEl: HTMLTextAreaElement): void {
  useInputListener(inputEl, "compositionstart", (event) => {
    console.debug("wordsInput event compositionstart", {
      event,
      data: event.data,
    });

    const now = performance.now();

    if (isTestRestarting() || isResultCalculating()) return;
    CompositionState.setComposing(true);
    CompositionState.setData("");
    setLastInsertCompositionTextData("");
    if (!isTestActive()) {
      TestLogic.startTest(now);
    }

    logTestEvent("composition", now, {
      event: "start",
      wordIndex: getActiveWordIndex(),
    });
  });

  useInputListener(inputEl, "compositionupdate", (event) => {
    console.debug("wordsInput event compositionupdate", {
      event,
      data: event.data,
    });

    if (isTestRestarting() || isResultCalculating()) return;
    CompositionState.setData(event.data);
    setCompositionText(event.data);

    const now = performance.now();

    logTestEvent("composition", now, {
      event: "update",
      data: event.data,
      wordIndex: getActiveWordIndex(),
    });
  });

  useInputListener(inputEl, "compositionend", async (event) => {
    console.debug("wordsInput event compositionend", {
      event,
      data: event.data,
    });

    if (isTestRestarting() || isResultCalculating()) return;
    CompositionState.setComposing(false);
    CompositionState.setData("");
    setCompositionText("");
    setLastInsertCompositionTextData("");

    const now = performance.now();

    if (event.data !== "") {
      await onInsertText({
        data: event.data,
        now,
        isCompositionEnding: true,
      });
    }

    logTestEvent("composition", now, {
      event: "end",
      data: event.data,
      wordIndex: getActiveWordIndex(),
    });
  });
}
