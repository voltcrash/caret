import { createAppOwned } from "../../app/application";
import type { Command, CommandlineListKey, CommandsSubgroup } from "./types";

/** Positions in the root command list where features add commands. */
export type CommandSlot = "result" | "test" | "behavior" | "other";

/** Commands a feature adds to the palette while it is registered. */
export type CommandContribution = {
  commands?: Partial<Record<CommandSlot, Command[]>>;
  lists?: Partial<Record<CommandlineListKey, CommandsSubgroup>>;
};

const getContributions = createAppOwned(() => new Set<CommandContribution>());

/** Adds a feature's commands; the returned release removes them. */
export function registerCommands(
  contribution: CommandContribution,
): () => void {
  const contributions = getContributions();
  contributions.add(contribution);
  return () => {
    contributions.delete(contribution);
  };
}

export function contributedCommands(slot: CommandSlot): Command[] {
  return [...getContributions()].flatMap(
    (contribution) => contribution.commands?.[slot] ?? [],
  );
}

export function contributedList(
  key: CommandlineListKey,
): CommandsSubgroup | undefined {
  for (const contribution of getContributions()) {
    const list = contribution.lists?.[key];
    if (list !== undefined) return list;
  }
  return undefined;
}
