import { authEvent } from "../ts/events/auth";
import { showModal } from "../ts/states/modals";
import { getLastSignedOutResult } from "../ts/states/test";

// Lives outside the lazily loaded modal modules so events fired before a
// modal chunk loads still open it.

export function useModalTriggers(): void {
  authEvent.useListener((event) => {
    if (event.type === "snapshotUpdated" && event.data.isInitial) {
      if (getLastSignedOutResult() !== null) {
        showModal("LastSignedOutResult");
      }
    }
  });
}
