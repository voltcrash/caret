import type { Challenge } from "@caret/challenges";
import { createAppSignal } from "#app/state.ts";

export const [getLoadedChallenge, setLoadedChallenge] =
  createAppSignal<Challenge | null>(null);
