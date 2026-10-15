import { z } from "zod";

import {
  AuthMethod,
  getAuthMethodDisplay,
  hasAdditionalAuthMethods,
  removeAuthProvider,
} from "../../../auth";
import { isAuthenticated } from "../../../states/core";
import { showNoticeNotification } from "../../../states/notifications";
import { showSimpleModal } from "../../../states/simple-modal";

export function showRemoveAuthMethodModal(options: {
  authMethod: AuthMethod;
}): void {
  if (!isAuthenticated()) return;

  if (!hasAdditionalAuthMethods(options.authMethod)) {
    showNoticeNotification("No remaining authentication enabled");
    return;
  }

  showSimpleModal({
    title: `Remove ${getAuthMethodDisplay(options.authMethod)} authentication`,
    buttonText: "reauthenticate to remove",
    schema: z.object({}),
    inputs: {},
    execFn: async () => removeAuthProvider(options.authMethod),
  });
}
