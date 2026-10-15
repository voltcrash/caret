import { authEvent } from "../../events/auth";
import { googleSignUpEvent } from "../../events/google-sign-up";
import { setPendingGoogleSignUpUser } from "../../states/google-sign-up";
import { showModal } from "../../states/modals";
import { getLastSignedOutResult } from "../../states/test";

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
