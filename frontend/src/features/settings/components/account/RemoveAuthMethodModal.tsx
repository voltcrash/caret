import { z } from "zod";

import {
  AuthMethod,
  getAuthMethodDisplay,
  hasAdditionalAuthMethods,
  removeAuthProvider,
} from "../../../../ts/auth";
import { isAuthenticated } from "../../../../ts/states/core";
import { showNoticeNotification } from "../../../../ts/states/notifications";
import { showSimpleModal } from "../../../../ts/states/simple-modal";

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
