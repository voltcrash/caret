import { CustomTheme, CustomThemeNameSchema } from "@caret/schemas/users";
import { untrack } from "solid-js";
import { z } from "zod";

import { getConfig } from "#shared/config/store.ts";
import { convertThemeToCustomColors } from "#shared/controllers/theme-controller.ts";
import {
  showErrorNotification,
  showNoticeNotification,
  showSuccessNotification,
} from "#shared/states/notifications.ts";
import { showSimpleModal } from "#shared/states/simple-modal.ts";
import { getTheme } from "#shared/states/theme.ts";
import {
  normalizeName,
  replaceUnderscoresWithSpaces,
} from "#shared/utils/strings.ts";

import {
  deleteCustomTheme,
  editCustomTheme,
} from "../../../../../data/collections/custom-themes";

export function openShareCustomThemeModal(): void {
  showSimpleModal({
    title: "Share custom theme",
    schema: z.object({ includeBackground: z.boolean().optional() }),
    inputs: {
      includeBackground: {
        label: "Include background link, size and filters",
        type: "checkbox",
      },
    },
    buttonText: "copy link to clipboard",
    buttonAlwaysEnabled: true,
    execFn: async ({ includeBackground }) => {
      const newTheme: {
        c: string[]; //colors
        i?: string; //image
        s?: string; //size
        f?: object; //filter
      } = {
        c: convertThemeToCustomColors(getTheme()),
      };

      if (includeBackground) {
        newTheme.i = getConfig.customBackground;
        newTheme.s = getConfig.customBackgroundSize;
        newTheme.f = getConfig.customBackgroundFilter;
      }

      const link = `${window.location.origin}?customTheme=${btoa(
        JSON.stringify(newTheme),
      )}`;

      try {
        await navigator.clipboard.writeText(link);
        showSuccessNotification("URL Copied to clipboard");
      } catch {
        showNoticeNotification(
          "Looks like we couldn't copy the link straight to your clipboard. Please copy it manually.",
          {
            durationMs: 5000,
          },
        );

        setTimeout(() => {
          showSimpleModal({
            title: "Custom theme URL",
            class: "max-w-2xl",
            schema: z.object({ url: z.string() }),
            inputs: {
              url: {
                type: "textarea",
                placeholder: "URL",
                initVal: link,
                clickToSelect: true,
                readOnly: true,
                class: "h-50",
              },
            },
            execFn: async () => {
              return {
                status: "success",
                showNotification: false,
              };
            },
          });
        }, 250);
        // this is flaky, no chaining for simple modals
      }

      return {
        status: "success",
        showNotification: false,
      };
    },
  });
}

export function openEditCustomThemeModal(theme: CustomTheme): void {
  showSimpleModal({
    title: "Update custom theme",
    schema: z.object({
      name: CustomThemeNameSchema,
      updateColors: z.boolean(),
    }),
    inputs: {
      name: {
        type: "text",
        initVal: replaceUnderscoresWithSpaces(theme.name),
        preprocess: normalizeName,
      },
      updateColors: {
        type: "checkbox",
        label: "Update custom theme to current colors",
      },
    },
    buttonText: "update",
    execFn: async ({ name, updateColors }) => {
      if (name === undefined) {
        return {
          status: "error",
          message: "Name is required",
        };
      }
      editCustomTheme({
        themeId: theme._id,
        name,
        colors: updateColors
          ? convertThemeToCustomColors(untrack(() => getTheme()))
          : untrack(() => theme.colors),
      })
        .then(() => {
          showSuccessNotification("Updated");
        })
        .catch(() => {
          // The original handler read the click event here, never an Error,
          // so it always showed this fallback message.
          showErrorNotification("Failed to update custom theme");
        });

      return {
        status: "success",
        showNotification: false,
      };
    },
  });
}

export function openDeleteCustomThemeModal(theme: CustomTheme): void {
  showSimpleModal({
    title: "Delete custom theme",
    text: `Are you sure you want to delete the custom theme "${replaceUnderscoresWithSpaces(theme.name)}"? This action cannot be undone.`,
    buttonText: "delete",
    execFn: async () => {
      void deleteCustomTheme({
        themeId: theme._id,
      });
      return {
        status: "success",
        message: "Custom theme deleted",
      };
    },
  });
}
