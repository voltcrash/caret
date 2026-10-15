import { initServer } from "../hono-adapter";
import * as LeaderboardService from "../../services/operations/leaderboard";
import { leaderboardsContract } from "@oxytype/contracts/leaderboards";
import { callService } from "../ts-rest-adapter";

const s = initServer();
export default s.router(leaderboardsContract, {
  get: {
    handler: async (r) => callService(LeaderboardService.getLeaderboard)(r),
  },
  getRank: {
    handler: async (r) =>
      callService(LeaderboardService.getRankFromLeaderboard)(r),
  },
  getDaily: {
    handler: async (r) =>
      callService(LeaderboardService.getDailyLeaderboard)(r),
  },
  getDailyRank: {
    handler: async (r) =>
      callService(LeaderboardService.getDailyLeaderboardRank)(r),
  },
  getWeeklyXp: {
    handler: async (r) =>
      callService(LeaderboardService.getWeeklyXpLeaderboard)(r),
  },
  getWeeklyXpRank: {
    handler: async (r) =>
      callService(LeaderboardService.getWeeklyXpLeaderboardRank)(r),
  },
});
