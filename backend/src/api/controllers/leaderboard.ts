import { adaptService } from "../service-adapter";
import * as services from "../../services/operations/leaderboard";
export const getLeaderboard = adaptService(services.getLeaderboard);
export const getRankFromLeaderboard = adaptService(
  services.getRankFromLeaderboard,
);
export const getDailyLeaderboard = adaptService(services.getDailyLeaderboard);
export const getDailyLeaderboardRank = adaptService(
  services.getDailyLeaderboardRank,
);
export const getWeeklyXpLeaderboard = adaptService(
  services.getWeeklyXpLeaderboard,
);
export const getWeeklyXpLeaderboardRank = adaptService(
  services.getWeeklyXpLeaderboardRank,
);
