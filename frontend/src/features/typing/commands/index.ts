import { onCleanup } from "solid-js";

import { registerCommands } from "#shared/commandline/registry.ts";
import ResultScreenCommands from "./result-screen";
import FunboxCommands from "./funbox";
import LoadChallengeCommands from "./load-challenge";
import BailOutCommands from "./bail-out";
import QuoteFavoriteCommands from "./quote-favorites";
import EventLogCommands from "./event-log";

/** Adds typing commands to the mounted palette. */
export function useTypingCommands(): void {
  onCleanup(
    registerCommands({
      commands: {
        result: ResultScreenCommands,
        test: [...QuoteFavoriteCommands, ...BailOutCommands],
        behavior: FunboxCommands,
        other: LoadChallengeCommands,
        // Keeps its old place among the debug commands: palette search runs
        // the first match.
        debug: EventLogCommands,
      },
      lists: {
        loadChallenge: LoadChallengeCommands[0]?.subgroup,
        funbox: FunboxCommands[0]?.subgroup,
      },
    }),
  );
}
