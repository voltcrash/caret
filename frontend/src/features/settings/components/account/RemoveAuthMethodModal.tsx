import { z } from "zod";

import {
  AuthMethod,
  getAuthMethodDisplay,
  hasAdditionalAuthMethods,
  removeAuthProvider,
} from "#shared/auth.tsx";
import { isAuthenticated } from "#shared/states/core.ts";
import { showNoticeNotification } from "#shared/states/notifications.ts";
import { showSimpleModal } from "#shared/states/simple-modal.ts";

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
