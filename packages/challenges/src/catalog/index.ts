import { otherChallenges } from "./other";
import { funboxChallenges } from "./funboxes";
import { scriptChallenges } from "./scripts";
import { typingChallenges } from "./typing";
import { enduranceChallenges } from "./endurance";
import type { Challenge } from "../types";
import { ChallengeName } from "@oxytype/schemas/challenges";

export const challenges: Record<ChallengeName, Omit<Challenge, "name">> = {
  ...enduranceChallenges,
  ...typingChallenges,
  ...scriptChallenges,
  ...funboxChallenges,
  ...otherChallenges,
};
