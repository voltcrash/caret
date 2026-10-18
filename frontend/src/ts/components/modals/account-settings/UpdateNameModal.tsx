import { UserNameSchema } from "@oxytype/schemas/users";
import { z } from "zod";

import { operation } from "../../../../data/operations";
import { reauthenticate } from "../../../auth";
import { setSnapshot, getSnapshot } from "../../../db";
import { isAuthenticated } from "../../../states/core";
import { showSimpleModal } from "../../../states/simple-modal";
import { remoteValidation } from "../../../utils/remote-validation";

export function showUpdateNameModal(): void {
  const snapshot = getSnapshot();
  if (!isAuthenticated() || !snapshot) return;

  showSimpleModal({
    title: "Update name",
    buttonText: "reauthenticate to update",
    text: snapshot.needsToChangeName
      ? "You need to change your account name. This might be because you have a duplicate name, no account name or your name is not allowed (contains whitespace or invalid characters). Sorry for the inconvenience."
      : undefined,
    schema: z.object({
      newName: UserNameSchema,
    }),
    inputs: {
      newName: {
        placeholder: "new name",
        type: "text",
        validation: {
          isValid: remoteValidation(
            async (name: string) =>
              operation("users.getNameAvailability", { params: { name } }),
            { check: (data) => data.available || "Name not available" },
          ),
          debounceDelay: 1000,
        },
      },
    },

    execFn: async ({ newName }) => {
      const reauth = await reauthenticate();
      if (reauth.status !== "success") {
        return {
          status: reauth.status,
          message: reauth.message,
        };
      }

      const response = await operation("users.updateName", {
        body: { name: newName },
      });
      if (!response.ok) {
        return {
          status: "error",
          message: "Failed to update name",
          notificationOptions: { operation: response },
        };
      }

      const current = getSnapshot();
      if (current !== undefined) setSnapshot({ ...current, name: newName });

      return {
        status: "success",
        message: "Name updated",
      };
    },
  });
}
