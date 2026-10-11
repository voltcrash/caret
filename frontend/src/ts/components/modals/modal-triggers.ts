import { authEvent } from "../../events/auth";
import { googleSignUpEvent } from "../../events/google-sign-up";
import { setPendingGoogleSignUpUser } from "../../states/google-sign-up";
import { showModal } from "../../states/modals";
import { getLastSignedOutResult } from "../../states/test";

// Lives outside the lazily loaded modal modules so events fired before a
// modal chunk loads still open it.

googleSignUpEvent.subscribe(
  (data) => {
    if (data.signedInUser !== undefined && data.isNewUser) {
      setPendingGoogleSignUpUser(data.signedInUser);
      showModal("GoogleSignup");
    }
  },
  import.meta.hot,
);

authEvent.subscribe(
  (event) => {
    if (event.type === "snapshotUpdated" && event.data.isInitial) {
      if (getLastSignedOutResult() !== null) {
        showModal("LastSignedOutResult");
      }
    }
  },
  import.meta.hot,
);
