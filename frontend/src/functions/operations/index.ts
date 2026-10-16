import * as configsFns from "./configs";
import * as configurationFns from "./configuration";
import * as leaderboardsFns from "./leaderboards";
import * as presetsFns from "./presets";
import * as psasFns from "./psas";
import * as publicFns from "./public";
import * as quotesFns from "./quotes";
import * as resultsFns from "./results";
import * as usersFns from "./users";

/**
 * Server functions the browser operation client may call, by operation ID.
 * The rollback build substitutes its HTTP transport for this module.
 */
export const webOperations = {
  "configs.get": configsFns.configsGet,
  "configuration.get": configurationFns.configurationGet,
  "leaderboards.get": leaderboardsFns.leaderboardsGet,
  "leaderboards.getDaily": leaderboardsFns.leaderboardsGetDaily,
  "leaderboards.getDailyRank": leaderboardsFns.leaderboardsGetDailyRank,
  "leaderboards.getRank": leaderboardsFns.leaderboardsGetRank,
  "leaderboards.getWeeklyXp": leaderboardsFns.leaderboardsGetWeeklyXp,
  "leaderboards.getWeeklyXpRank": leaderboardsFns.leaderboardsGetWeeklyXpRank,
  "presets.get": presetsFns.presetsGet,
  "psas.get": psasFns.psasGet,
  "public.getSpeedHistogram": publicFns.publicGetSpeedHistogram,
  "public.getTypingStats": publicFns.publicGetTypingStats,
  "quotes.get": quotesFns.quotesGet,
  "quotes.getRating": quotesFns.quotesGetRating,
  "quotes.isSubmissionEnabled": quotesFns.quotesIsSubmissionEnabled,
  "results.get": resultsFns.resultsGet,
  "results.getById": resultsFns.resultsGetById,
  "users.get": usersFns.usersGet,
  "users.getCustomThemes": usersFns.usersGetCustomThemes,
  "users.getInbox": usersFns.usersGetInbox,
  "users.getNameAvailability": usersFns.usersGetNameAvailability,
  "users.getProfile": usersFns.usersGetProfile,
  "users.getTestActivity": usersFns.usersGetTestActivity,
};
