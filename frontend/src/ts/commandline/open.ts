import type { CommandsSubgroup, CommandlineSubgroupKey } from "./types";
import { showModal } from "../states/modals";

type ShowSettings = {
  subgroupOverride?: CommandsSubgroup | CommandlineSubgroupKey;
  commandOverride?: string;
  singleListOverride?: boolean;
};

let pendingSettings: ShowSettings | undefined;

export function show(settings?: ShowSettings): void {
  pendingSettings = settings;
  showModal("Commandline");
}

export function takePendingSettings(): ShowSettings | undefined {
  const settings = pendingSettings;
  pendingSettings = undefined;
  return settings;
}
