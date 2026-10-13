import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";

import type { ConfigStore } from "./store";
import type { Notifications } from "../notifications";
import type { Command } from "../palette/types";

function parseConfigJson(value: string): object {
  const parsed: unknown = JSON.parse(value);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Settings JSON must be an object");
  }
  return parsed;
}

function filePath(value: string): string {
  if (value.trim() === "") throw new Error("Enter a file path");
  return resolve(
    value.startsWith("~/") ? `${homedir()}/${value.slice(2)}` : value,
  );
}

export function configTools(context: {
  store: ConfigStore;
  notifications: Notifications;
  copy: (text: string) => boolean;
}): Command[] {
  const { store, notifications } = context;
  return [
    {
      id: "resetSettings",
      display: "Reset settings...",
      alias: "defaults config",
      subgroup: () => ({
        title: "Reset all settings?",
        list: [
          { id: "cancelResetSettings", display: "Cancel" },
          {
            id: "confirmResetSettings",
            display: "Reset to defaults",
            exec: async () => {
              store.reset();
              await store.flush();
              notifications.notify("Settings reset", "success");
            },
          },
        ],
      }),
    },
    {
      id: "importSettingsJSON",
      display: "Import settings JSON",
      alias: "import config",
      input: {
        submit: async (value) => {
          if (value.trim() === "") return undefined;
          try {
            store.apply(parseConfigJson(value));
            await store.flush();
            notifications.notify("Settings imported", "success");
          } catch (error) {
            return error instanceof Error ? error.message : "Invalid JSON";
          }
          return undefined;
        },
      },
    },
    {
      id: "exportSettingsJSON",
      display: "Export settings JSON",
      alias: "export config",
      exec: () => {
        notifications.notify(
          context.copy(JSON.stringify(store.config))
            ? "Settings JSON copied to clipboard"
            : "This terminal cannot copy; use Export settings file",
        );
      },
    },
    {
      id: "importSettingsFile",
      display: "Import settings file...",
      alias: "config json path",
      input: {
        placeholder: "JSON file path",
        submit: async (value) => {
          const text = await readFile(filePath(value), "utf8");
          if (text.length > 1_000_000) return "Settings file too large";
          store.apply(parseConfigJson(text));
          await store.flush();
          notifications.notify("Settings imported", "success");
          return undefined;
        },
      },
    },
    {
      id: "exportSettingsFile",
      display: "Export settings file...",
      alias: "config json path",
      input: {
        placeholder: "New JSON file path",
        submit: async (value) => {
          await writeFile(
            filePath(value),
            `${JSON.stringify(store.config, null, 2)}\n`,
            { mode: 0o600, flag: "wx" },
          );
          notifications.notify("Settings exported", "success");
          return undefined;
        },
      },
    },
  ];
}
