import { getEngineSession } from "../../runtime/session.client";
import {
  isTestRestarting,
  isResultCalculating,
} from "../../../../ts/states/test";
import { observeInputView } from "./before-insert-text";

export function onBeforeDelete(event: InputEvent): void {
  const session = getEngineSession();
  if (!session.isPrepared() || isTestRestarting() || isResultCalculating()) {
    event.preventDefault();
    return;
  }
  observeInputView(performance.now());
  if (!session.canDelete()) {
    event.preventDefault();
  }
}
