import type { OperationId } from "../../policies/operations";
import type { MonkeyResponse } from "../../utils/monkey-response";
import type { ServiceContext } from "../context";
import * as Admin from "./admin";
import * as ApeKey from "./ape-key";
import * as Config from "./config";
import * as Configuration from "./configuration";
import * as Dev from "./dev";
import * as Leaderboard from "./leaderboard";
import * as Preset from "./preset";
import * as Psa from "./psa";
import * as Public from "./public";
import * as Quote from "./quote";
import * as Result from "./result";
import * as User from "./user";

/** Each service narrows its own validated input. */
type Service = (
  context: ServiceContext,
  input: never,
) => Promise<MonkeyResponse<unknown>>;

/**
 * The single business implementation of every contract operation. Start
 * functions, retained HTTP routes and the rollback Hono adapter all dispatch
 * here after running the same policies; no transport owns business rules.
 */
export const operationServices = {
  "admin.test": Admin.test,
  "admin.toggleBan": Admin.toggleBan,
  "admin.clearStreakHourOffset": Admin.clearStreakHourOffset,
  "admin.deleteUser": Admin.deleteUser,
  "admin.acceptReports": Admin.acceptReports,
  "admin.rejectReports": Admin.rejectReports,
  "admin.clearSuspicious": Admin.clearSuspicious,
  "admin.getAnticheatAudits": Admin.getAnticheatAudits,
  "admin.getAnticheatSummary": Admin.getAnticheatSummary,
  "apeKeys.get": ApeKey.getApeKeys,
  "apeKeys.add": ApeKey.generateApeKey,
  "apeKeys.save": ApeKey.editApeKey,
  "apeKeys.delete": ApeKey.deleteApeKey,
  "configs.get": Config.getConfig,
  "configs.save": Config.saveConfig,
  "configs.delete": Config.deleteConfig,
  "configuration.get": Configuration.getConfiguration,
  "configuration.update": Configuration.updateConfiguration,
  "configuration.getSchema": Configuration.getSchema,
  "dev.generateData": Dev.createTestData,
  "dev.addDebugInboxItem": Dev.addDebugInboxItem,
  "leaderboards.get": Leaderboard.getLeaderboard,
  "leaderboards.getRank": Leaderboard.getRankFromLeaderboard,
  "leaderboards.getDaily": Leaderboard.getDailyLeaderboard,
  "leaderboards.getDailyRank": Leaderboard.getDailyLeaderboardRank,
  "leaderboards.getWeeklyXp": Leaderboard.getWeeklyXpLeaderboard,
  "leaderboards.getWeeklyXpRank": Leaderboard.getWeeklyXpLeaderboardRank,
  "presets.get": Preset.getPresets,
  "presets.add": Preset.addPreset,
  "presets.save": Preset.editPreset,
  "presets.delete": Preset.removePreset,
  "psas.get": Psa.getPsas,
  "public.getSpeedHistogram": Public.getSpeedHistogram,
  "public.getTypingStats": Public.getTypingStats,
  "quotes.get": Quote.getQuotes,
  "quotes.isSubmissionEnabled": Quote.isSubmissionEnabled,
  "quotes.add": Quote.addQuote,
  "quotes.approveSubmission": Quote.approveQuote,
  "quotes.rejectSubmission": Quote.refuseQuote,
  "quotes.getRating": Quote.getRating,
  "quotes.addRating": Quote.submitRating,
  "quotes.report": Quote.reportQuote,
  "results.get": Result.getResults,
  "results.getById": Result.getResultById,
  "results.add": Result.addResult,
  "results.updateTags": Result.updateTags,
  "results.getLast": Result.getLastResult,
  "users.get": User.getUser,
  "users.create": User.createNewUser,
  "users.getNameAvailability": User.checkName,
  "users.delete": User.deleteUser,
  "users.reset": User.resetUser,
  "users.updateName": User.updateName,
  "users.updateLeaderboardMemory": User.updateLbMemory,
  "users.getPersonalBests": User.getPersonalBests,
  "users.deletePersonalBests": User.clearPb,
  "users.optOutOfLeaderboards": User.optOutOfLeaderboards,
  "users.addResultFilterPreset": User.addResultFilterPreset,
  "users.removeResultFilterPreset": User.removeResultFilterPreset,
  "users.getTags": User.getTags,
  "users.createTag": User.addTag,
  "users.editTag": User.editTag,
  "users.deleteTag": User.removeTag,
  "users.deleteTagPersonalBest": User.clearTagPb,
  "users.getCustomThemes": User.getCustomThemes,
  "users.addCustomTheme": User.addCustomTheme,
  "users.deleteCustomTheme": User.removeCustomTheme,
  "users.editCustomTheme": User.editCustomTheme,
  "users.getStats": User.getStats,
  "users.setStreakHourOffset": User.setStreakHourOffset,
  "users.getFavoriteQuotes": User.getFavoriteQuotes,
  "users.addQuoteToFavorites": User.addFavoriteQuote,
  "users.removeQuoteFromFavorites": User.removeFavoriteQuote,
  "users.getProfile": User.getProfile,
  "users.updateProfile": User.updateProfile,
  "users.getInbox": User.getInbox,
  "users.updateInbox": User.updateInbox,
  "users.report": User.reportUser,
  "users.revokeAllTokens": User.revokeAllTokens,
  "users.getTestActivity": User.getTestActivity,
  "users.getCurrentTestActivity": User.getCurrentTestActivity,
  "users.getStreak": User.getStreak,
} satisfies Record<OperationId, Service>;

export type OperationServices = typeof operationServices;

/** Operations whose former route also required a development deployment. */
export const developmentOnlyOperations: ReadonlySet<OperationId> = new Set([
  "dev.generateData",
  "dev.addDebugInboxItem",
]);
