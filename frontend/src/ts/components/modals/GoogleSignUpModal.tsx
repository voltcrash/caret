import { UserNameSchema } from "@oxytype/schemas/users";
import { createForm } from "@tanstack/solid-form";

import { operation } from "../../../data/operations";
import { loadUser, signOut } from "../../auth";
import {
  updateProfile,
  deleteUnfinishedUser,
  resetIgnoreAuthCallback,
  setUserState,
} from "../../auth-client";
import { authEvent } from "../../events/auth";
import {
  getPendingGoogleSignUpUser,
  setPendingGoogleSignUpUser,
} from "../../states/google-sign-up";
import { hideLoaderBar, showLoaderBar } from "../../states/loader-bar";
import { hideModal, ModalId } from "../../states/modals";
import {
  showErrorNotification,
  showNoticeNotification,
  showSuccessNotification,
} from "../../states/notifications";
import { remoteValidationForm } from "../../utils/remote-validation";
import { AnimatedModal } from "../common/AnimatedModal";
import { Captcha } from "../ui/form/Captcha";
import { InputField } from "../ui/form/InputField";
import { SubmitButton } from "../ui/form/SubmitButton";
import { allFieldsMandatory, fromSchema } from "../ui/form/utils";

const modalId: ModalId = "GoogleSignup";

export function GoogleSignupModal() {
  const form = createForm(() => ({
    defaultValues: {
      username: "",
      captcha: "",
    },
    onSubmit: async ({ value }) => {
      try {
        await apply(value);
      } finally {
        form.setFieldValue("captcha", "");
      }
    },
    onSubmitInvalid: () => {
      showNoticeNotification("Please fill in all fields");
    },
    validators: {
      onChange: allFieldsMandatory(),
    },
  }));

  return (
    <AnimatedModal
      id={modalId}
      title="Account name"
      mode="dialog"
      afterHide={() => void afterHide()}
    >
      <p>Please enter a username before continuing</p>
      <form
        class="flex flex-col justify-center gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <form.Field
          name="username"
          validators={{
            onChange: fromSchema(UserNameSchema),
            onChangeAsyncDebounceMs: 1000,
            onChangeAsync: remoteValidationForm(
              async (name: string) =>
                operation("users.getNameAvailability", { params: { name } }),
              { check: (data) => data.available || "Name not available" },
            ),
          }}
          children={(field) => (
            <InputField field={field} placeholder="username" type="input" />
          )}
        />
        <form.Field
          name="captcha"
          children={(field) => (
            <Captcha
              field={field}
              action="signup"
              class="flex w-full flex-row justify-center"
            />
          )}
        />

        <SubmitButton form={form} text="continue" />
      </form>
    </AnimatedModal>
  );
}

async function afterHide(): Promise<void> {
  resetIgnoreAuthCallback();
  if (getPendingGoogleSignUpUser() !== undefined) {
    showNoticeNotification("Sign up process cancelled", {
      durationMs: 5000,
    });
    await deleteUnfinishedUser().catch((error: unknown) => {
      showErrorNotification("Failed to cancel sign up", { error });
    });
    signOut();
    setPendingGoogleSignUpUser(undefined);
  }
}
async function apply(options: {
  username: string;
  captcha: string;
}): Promise<void> {
  const { username: name, captcha } = options;
  const signedInUser = getPendingGoogleSignUpUser();
  if (!signedInUser) {
    showErrorNotification(
      "Missing user credential. Please close the popup and try again.",
    );
    return;
  }
  if (!captcha) {
    showNoticeNotification("Please complete the captcha");
    return;
  }

  showLoaderBar();
  let closeModal = true;
  try {
    if (name.length === 0) throw new Error("Name cannot be empty");
    const response = await operation("users.create", {
      body: { name, captcha },
    });
    if (response.status === 422) {
      closeModal = false;
      showErrorNotification("Verification failed. Please try again.", {
        operation: response,
      });
      return;
    }
    if (!response.ok) {
      throw new Error(`Failed to create user: ${response.message}`);
    }

    setUserState(signedInUser.user);
    await updateProfile(name);
    showSuccessNotification("Account created");
    await loadUser(signedInUser.user);

    authEvent.dispatch({
      type: "authStateChanged",
      data: { isUserSignedIn: true, loadPromise: Promise.resolve() },
    });
    setPendingGoogleSignUpUser(undefined);
  } catch (e) {
    console.log(e);
    showErrorNotification("Failed to create account", { error: e });
    if (getPendingGoogleSignUpUser() !== undefined) {
      await deleteUnfinishedUser().catch(() => {
        //user might be deleted already by the server
      });
    }
    signOut();
    setPendingGoogleSignUpUser(undefined);
  } finally {
    hideLoaderBar();
    if (closeModal) hideModal(modalId);
  }
}
