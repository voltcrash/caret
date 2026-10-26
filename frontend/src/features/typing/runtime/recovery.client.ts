import { EngineFailure } from "@caret/typing-engine/failure";
import { FunboxNameSchema } from "@caret/schemas/configs";
import { LanguageSchema } from "@caret/schemas/languages";
import { ModeSchema } from "@caret/schemas/shared";
import {
  setConfig,
  setQuoteLengthAll,
  toggleFunbox,
} from "../../../ts/config/setters";
import {
  showErrorNotification,
  showNoticeNotification,
} from "../../../ts/states/notifications";

/** Execute ordered engine recovery with the existing platform setters/notices. */
export function applyEngineRecovery(
  error: EngineFailure,
  restart?: () => void,
): void {
  for (const action of error.recovery) {
    switch (action.op) {
      case "setMode":
        setConfig("mode", ModeSchema.parse(action.mode));
        break;
      case "setQuoteLengthAll":
        setQuoteLengthAll();
        break;
      case "disableFunbox":
        // Preserve the legacy callback's second setter argument (named noRestart
        // in its interface, forwarded as nosave by the website).
        toggleFunbox(
          FunboxNameSchema.parse(action.name),
          action.noRestart ? true : undefined,
        );
        break;
      case "setLanguage":
        setConfig("language", LanguageSchema.parse(action.language), {
          nosave: action.noSave,
        });
        break;
      case "notice":
        showNoticeNotification(action.message, {
          durationMs: action.durationMs,
        });
        break;
      case "errorNotice":
        showErrorNotification(action.message);
        break;
      case "restart":
        restart?.();
        break;
    }
  }
}
export function generationFailureIsNotice(error: EngineFailure): boolean {
  return [
    "noQuotes",
    "selectedQuoteMissing",
    "noFavorites",
    "noQuoteLength",
    "onePolyglotLanguage",
    "polyglotDirection",
  ].includes(error.code);
}
