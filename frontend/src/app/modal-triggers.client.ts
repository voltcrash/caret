import { authEvent } from "../ts/events/auth";
import { googleSignUpEvent } from "../ts/events/google-sign-up";
import { setPendingGoogleSignUpUser } from "../ts/states/google-sign-up";
import { showModal } from "../ts/states/modals";
import { getLastSignedOutResult } from "../ts/states/test";

// Lives outside the lazily loaded modal modules so events fired before a
// modal chunk loads still open it.

export function useModalTriggers(): void {
  googleSignUpEvent.useListener((data) => {
    if (data.signedInUser !== undefined && data.isNewUser) {
      setPendingGoogleSignUpUser(data.signedInUser);
      showModal("GoogleSignup");
    }
  });
  authEvent.useListener((event) => {
    if (event.type === "snapshotUpdated" && event.data.isInitial) {
      if (getLastSignedOutResult() !== null) {
        showModal("LastSignedOutResult");
      }
    }
  });
}
