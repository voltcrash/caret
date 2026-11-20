import { z } from "zod";

import { reauthenticate } from "#shared/auth.tsx";
import { resetConfig } from "#shared/config/lifecycle.ts";
import { getSnapshot, setSnapshot } from "#shared/db.ts";
import { isAuthenticated } from "#shared/states/core.ts";
import { showNoticeNotification } from "#shared/states/notifications.ts";
import { ExecReturn, showSimpleModal } from "#shared/states/simple-modal.ts";
import FileStorage from "#shared/utils/file-storage.ts";
import { reloadAfter } from "#shared/utils/misc.ts";

import { operation } from "../../../../data/operations";

export function showDeleteAccountModal(): void {
  showReauthConfirmModal({
    title: "Delete account",
    buttonText: "delete",
    confirmText: `I understand that all my data will be deleted and cannot be recovered.`,
    action: async () => {
      showNoticeNotification("Deleting all data...");
      const response = await operation("users.delete");

      if (!response.ok) {
        return {
          status: "error",
          message: "Failed to delete user data",
          notificationOptions: { operation: response },
        };
      }
      reloadAfter(3);

      return {
        status: "success",
        message: "Account deleted, goodbye",
      };
    },
  });
}

export function showOptOutOfLeaderboardsModal(): void {
  showReauthConfirmModal({
    title: "Opt out of leaderboards",
    buttonText: "opt out",
    confirmText: `I understand that my account will be removed from all leaderboards and that this cannot be undone.`,

    action: async () => {
      const response = await operation("users.optOutOfLeaderboards");
      if (!response.ok) {
        return {
          status: "error",
          message: "Failed to opt out",
          notificationOptions: { operation: response },
        };
      }

      reloadAfter(3);

      return {
        status: "success",
        message: "Leaderboards opt out successful",
      };
    },
  });
}

export function showResetAccountModal(): void {
  showReauthConfirmModal({
    title: "Reset account",
    buttonText: "reset",
    confirmText: `I understand that my account will be completely reset and that this cannot be undone.`,
    action: async () => {
      showNoticeNotification("Resetting settings...");
      await resetConfig();
      await FileStorage.deleteFile("LocalBackgroundFile");
      await FileStorage.deleteFile("LocalFontFamilyFile");

      showNoticeNotification("Resetting account...");
      const response = await operation("users.reset");
      if (!response.ok) {
        return {
          status: "error",
          message: "Failed to reset account",
          notificationOptions: { operation: response },
        };
      }

      reloadAfter(3);

      return {
        status: "success",
        message: "Account reset",
      };
    },
  });
}

export function showResetPersonalBestsModal(): void {
  showReauthConfirmModal({
    title: "Reset personal bests",
    buttonText: "reset",
    confirmText: `I understand that all my personal bests will be deleted and that this cannot be undone.`,
    action: async () => {
      const response = await operation("users.deletePersonalBests");
      if (!response.ok) {
        return {
          status: "error",
          message: "Failed to reset personal bests",
          notificationOptions: { operation: response },
        };
      }

      const snapshot = getSnapshot();
      if (!snapshot) {
        return {
          status: "error",
          message: "Failed to reset personal bests: no snapshot",
        };
      }

      snapshot.personalBests = {
        time: {},
        words: {},
        quote: {},
        zen: {},
        custom: {},
      };
      setSnapshot(snapshot);

      return {
        status: "success",
        message: "Personal bests reset",
      };
    },
  });
}

export function showRevokeAllTokensModal() {
  showReauthConfirmModal({
    title: "Revoke all tokens",
    confirmText: `I understand that all my tokens will get revoked and that I will be logged out of all devices.`,
    buttonText: "revoke all",
    action: async () => {
      const response = await operation("users.revokeAllTokens");
      if (!response.ok) {
        return {
          status: "error",
          message: "Failed to revoke tokens",
          notificationOptions: { operation: response },
        };
      }

      reloadAfter(3);

      return {
        status: "success",
        message: "Tokens revoked",
      };
    },
  });
}

function showReauthConfirmModal(options: {
  title: string;
  buttonText: string;
  confirmText: string;
  action: () => Promise<ExecReturn>;
}): void {
  if (!isAuthenticated()) return;

  showSimpleModal({
    title: options.title,
    buttonText: `reauthenticate to ${options.buttonText}`,
    schema: z.object({
      confirm: z.literal(true),
    }),
    inputs: {
      confirm: {
        type: "checkbox",
        label: options.confirmText,
      },
    },

    execFn: async () => {
      const reauth = await reauthenticate();
      if (reauth.status !== "success") {
        return {
          status: reauth.status,
          message: reauth.message,
        };
      }

      return options.action();
    },
  });
}
