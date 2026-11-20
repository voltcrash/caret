import { isDebugLogging } from "#shared/utils/logger.ts";
import { useInputListener } from "#shared/hooks/useInputListener.ts";
import { onKeyup } from "../handlers/keyup";
import { onKeydown } from "../handlers/keydown";

export function bindKeyListeners(inputEl: HTMLTextAreaElement): void {
  useInputListener(inputEl, "keyup", async (event) => {
    if (isDebugLogging()) {
      console.debug("wordsInput event keyup", {
        event,
        key: event.key,
        code: event.code,
      });
    }

    await onKeyup(event);
  });

  useInputListener(inputEl, "keydown", async (event) => {
    if (isDebugLogging()) {
      console.debug("wordsInput event keydown", {
        event,
        key: event.key,
        code: event.code,
      });
    }

    await onKeydown(event);
  });
}
