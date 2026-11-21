import { isDebugLogging } from "#shared/utils/logger.ts";
import { useInputListener } from "#shared/hooks/useInputListener.ts";
import * as CompositionState from "#shared/states/composition.ts";
import * as TestLogic from "../../runtime/test/logic";
import { setLastInsertCompositionTextData } from "../state";
import { onInsertText } from "../handlers/insert-text";
import { logTestEvent } from "../../runtime/events/data";
import {
  isTestRestarting,
  getActiveWordIndex,
  isResultCalculating,
  isTestActive,
} from "#shared/states/test.ts";
import { setCompositionText } from "#features/typing/state/composition.ts";

export function bindCompositionListeners(inputEl: HTMLTextAreaElement): void {
  useInputListener(inputEl, "compositionstart", (event) => {
    if (isDebugLogging()) {
      console.debug("wordsInput event compositionstart", {
        event,
        data: event.data,
      });
    }

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
    if (isDebugLogging()) {
      console.debug("wordsInput event compositionupdate", {
        event,
        data: event.data,
      });
    }

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
    if (isDebugLogging()) {
      console.debug("wordsInput event compositionend", {
        event,
        data: event.data,
      });
    }

    const blocked = isTestRestarting() || isResultCalculating();
    CompositionState.setComposing(false);
    CompositionState.setData("");
    setCompositionText("");
    setLastInsertCompositionTextData("");

    if (blocked) return;
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
