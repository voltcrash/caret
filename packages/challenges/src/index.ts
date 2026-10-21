import { challenges } from "./catalog";
import type { Challenge } from "./types";
import { ChallengeName } from "@oxytype/schemas/challenges";

const map: Record<ChallengeName, Challenge> = Object.fromEntries(
  Object.entries(challenges).map(([name, def]) => [name, { ...def, name }]),
) as Record<ChallengeName, Challenge>;

const list: Challenge[] = Object.values(map);

export function getChallenges(): Challenge[] {
  return list;
}

export function getChallenge(name: ChallengeName): Challenge {
  return map[name];
}
export type { Challenge, ChallengeSettings, ChallengeResult } from "./types";

export { verifyChallenge } from "./verification";

export { challengeSetup } from "./setup";
