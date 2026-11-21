import { Command } from "#shared/commandline/types.ts";
import {
  showErrorNotification,
  showSuccessNotification,
} from "#shared/states/notifications.ts";
import { getLastEventLog } from "#features/typing/state/event-log.ts";

const commands: Command[] = [
  {
    id: "copyResultStats",
    display: "Copy last event log (result data)",
    alias: "stats events",
    icon: "fa-cog",
    visible: false,
    available: (): boolean => {
      return getLastEventLog() !== null;
    },
    exec: async (): Promise<void> => {
      navigator.clipboard
        .writeText(JSON.stringify(getLastEventLog()))
        .then(() => {
          showSuccessNotification("Copied to clipboard");
        })
        .catch((e: unknown) => {
          showErrorNotification("Failed to copy to clipboard", { error: e });
        });
    },
  },
];

export default commands;
