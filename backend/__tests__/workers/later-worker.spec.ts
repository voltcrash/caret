import { describe, it, expect } from "vite-plus/test";
import * as LaterWorker from "../../src/workers/later-worker";
import { BASE_CONFIGURATION } from "../../src/constants/base-configuration";
const calculateXpReward = LaterWorker.__testing.calculateXpReward;

describe("later-worker", () => {
  describe("calculateXpReward", () => {
    it("should return the correct XP reward for a given rank", () => {
      //GIVEN
      const xpRewardBrackets = [
        { minRank: 1, maxRank: 1, minReward: 100, maxReward: 100 },
        { minRank: 2, maxRank: 10, minReward: 50, maxReward: 90 },
      ];

      //WHEN / THEN
      expect(calculateXpReward(xpRewardBrackets, 5)).toBe(75);
      expect(calculateXpReward(xpRewardBrackets, 11)).toBeUndefined();
    });

    it("should return the highest XP reward if brackets overlap", () => {
      //GIVEN
      const xpRewardBrackets = [
        { minRank: 1, maxRank: 5, minReward: 900, maxReward: 1000 },
        { minRank: 2, maxRank: 20, minReward: 50, maxReward: 90 },
      ];

      //WHEN
      const reward = calculateXpReward(xpRewardBrackets, 5);

      //THEN
      expect(reward).toBe(900);
    });

    it.each([
      [1, 5000],
      [2, 2500],
      [10, 1000],
      [11, 900],
      [100, 100],
      [101, undefined],
    ])("rewards daily rank %i with %s xp by default", (rank, xp) => {
      const { xpRewardBrackets } = BASE_CONFIGURATION.dailyLeaderboards;
      expect(calculateXpReward(xpRewardBrackets, rank)).toBe(xp);
    });
  });
});
