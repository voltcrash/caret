import { onCleanup } from "solid-js";

import { registerCommands } from "../../../ts/commandline/registry";
import ResultScreenCommands from "./result-screen";
import FunboxCommands from "./funbox";
import LoadChallengeCommands from "./load-challenge";
import BailOutCommands from "./bail-out";
import QuoteFavoriteCommands from "./quote-favorites";

/** Adds typing commands to the mounted palette. */
export function useTypingCommands(): void {
  onCleanup(
    registerCommands({
      commands: {
        result: ResultScreenCommands,
        test: [...QuoteFavoriteCommands, ...BailOutCommands],
        behavior: FunboxCommands,
        other: LoadChallengeCommands,
      },
      lists: {
        loadChallenge: LoadChallengeCommands[0]?.subgroup,
        funbox: FunboxCommands[0]?.subgroup,
      },
    }),
  );
}
