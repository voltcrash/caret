import type { SessionState } from "@caret/schemas/auth-session";

/** Storybook has no authenticated server. */
export async function getSessionState(): Promise<SessionState> {
  return { user: null, signUpEnabled: false };
}
async function unavailable(): Promise<never> {
  throw new Error("Server functions are unavailable in Storybook");
}
export {
  unavailable as completeSignUp,
  unavailable as getProfile,
  unavailable as getLeaderboard,
  unavailable as getLeaderboardRank,
  unavailable as getAccountStats,
};
