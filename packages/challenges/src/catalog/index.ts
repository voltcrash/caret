import { otherChallenges } from "./other";
import { funboxChallenges } from "./funboxes";
import { scriptChallenges } from "./scripts";
import { typingChallenges } from "./typing";
import { enduranceChallenges } from "./endurance";
import type { Challenge } from "../types";
import { ChallengeName } from "@caret/schemas/challenges";

// Integer-like "69" stays first in Object.entries, including after these spreads.
export const challenges: Record<ChallengeName, Omit<Challenge, "name">> = {
  ...enduranceChallenges,
  ...typingChallenges,
  ...scriptChallenges,
  ...funboxChallenges,
  ...otherChallenges,
};
