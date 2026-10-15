import { createAccountOwned } from "../../app/account-scope";
import type { CommandsSubgroup, CommandlineSubgroupKey } from "./types";
import { showModal } from "../states/modals";

type ShowSettings = {
  subgroupOverride?: CommandsSubgroup | CommandlineSubgroupKey;
  commandOverride?: string;
  singleListOverride?: boolean;
};

const pending = createAccountOwned(() => ({
  settings: undefined as ShowSettings | undefined,
}));

export function show(settings?: ShowSettings): void {
  pending().settings = settings;
  showModal("Commandline");
}

export function takePendingSettings(): ShowSettings | undefined {
  const settings = pending().settings;
  pending().settings = undefined;
  return settings;
}
