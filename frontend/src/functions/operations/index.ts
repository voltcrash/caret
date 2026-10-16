import * as configsFns from "./configs";
import * as configurationFns from "./configuration";
import * as devFns from "./dev";
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
  "configs.delete": configsFns.configsDelete,
  "configs.get": configsFns.configsGet,
  "configs.save": configsFns.configsSave,
  "configuration.get": configurationFns.configurationGet,
  "dev.addDebugInboxItem": devFns.devAddDebugInboxItem,
  "dev.generateData": devFns.devGenerateData,
  "leaderboards.get": leaderboardsFns.leaderboardsGet,
  "leaderboards.getDaily": leaderboardsFns.leaderboardsGetDaily,
  "leaderboards.getDailyRank": leaderboardsFns.leaderboardsGetDailyRank,
  "leaderboards.getRank": leaderboardsFns.leaderboardsGetRank,
  "leaderboards.getWeeklyXp": leaderboardsFns.leaderboardsGetWeeklyXp,
  "leaderboards.getWeeklyXpRank": leaderboardsFns.leaderboardsGetWeeklyXpRank,
  "presets.add": presetsFns.presetsAdd,
  "presets.delete": presetsFns.presetsDelete,
  "presets.get": presetsFns.presetsGet,
  "presets.save": presetsFns.presetsSave,
  "psas.get": psasFns.psasGet,
  "public.getSpeedHistogram": publicFns.publicGetSpeedHistogram,
  "public.getTypingStats": publicFns.publicGetTypingStats,
  "quotes.add": quotesFns.quotesAdd,
  "quotes.addRating": quotesFns.quotesAddRating,
  "quotes.approveSubmission": quotesFns.quotesApproveSubmission,
  "quotes.get": quotesFns.quotesGet,
  "quotes.getRating": quotesFns.quotesGetRating,
  "quotes.isSubmissionEnabled": quotesFns.quotesIsSubmissionEnabled,
  "quotes.rejectSubmission": quotesFns.quotesRejectSubmission,
  "quotes.report": quotesFns.quotesReport,
  "results.add": resultsFns.resultsAdd,
  "results.get": resultsFns.resultsGet,
  "results.getById": resultsFns.resultsGetById,
  "results.updateTags": resultsFns.resultsUpdateTags,
  "users.addCustomTheme": usersFns.usersAddCustomTheme,
  "users.addQuoteToFavorites": usersFns.usersAddQuoteToFavorites,
  "users.addResultFilterPreset": usersFns.usersAddResultFilterPreset,
  "users.create": usersFns.usersCreate,
  "users.createTag": usersFns.usersCreateTag,
  "users.delete": usersFns.usersDelete,
  "users.deleteCustomTheme": usersFns.usersDeleteCustomTheme,
  "users.deletePersonalBests": usersFns.usersDeletePersonalBests,
  "users.deleteTag": usersFns.usersDeleteTag,
  "users.deleteTagPersonalBest": usersFns.usersDeleteTagPersonalBest,
  "users.editCustomTheme": usersFns.usersEditCustomTheme,
  "users.editTag": usersFns.usersEditTag,
  "users.get": usersFns.usersGet,
  "users.getCustomThemes": usersFns.usersGetCustomThemes,
  "users.getInbox": usersFns.usersGetInbox,
  "users.getNameAvailability": usersFns.usersGetNameAvailability,
  "users.getProfile": usersFns.usersGetProfile,
  "users.getTestActivity": usersFns.usersGetTestActivity,
  "users.optOutOfLeaderboards": usersFns.usersOptOutOfLeaderboards,
  "users.removeQuoteFromFavorites": usersFns.usersRemoveQuoteFromFavorites,
  "users.removeResultFilterPreset": usersFns.usersRemoveResultFilterPreset,
  "users.report": usersFns.usersReport,
  "users.reset": usersFns.usersReset,
  "users.revokeAllTokens": usersFns.usersRevokeAllTokens,
  "users.setStreakHourOffset": usersFns.usersSetStreakHourOffset,
  "users.updateInbox": usersFns.usersUpdateInbox,
  "users.updateLeaderboardMemory": usersFns.usersUpdateLeaderboardMemory,
  "users.updateName": usersFns.usersUpdateName,
  "users.updateProfile": usersFns.usersUpdateProfile,
};
