import { usersContract } from "@oxytype/contracts/users";
import { initServer } from "../hono-adapter";
import * as UserService from "../../services/operations/user";
import { callService } from "../ts-rest-adapter";

const s = initServer();
export default s.router(usersContract, {
  get: {
    handler: async (r) => callService(UserService.getUser)(r),
  },
  create: {
    handler: async (r) => callService(UserService.createNewUser)(r),
  },
  getNameAvailability: {
    handler: async (r) => callService(UserService.checkName)(r),
  },
  delete: {
    handler: async (r) => callService(UserService.deleteUser)(r),
  },
  reset: {
    handler: async (r) => callService(UserService.resetUser)(r),
  },
  updateName: {
    handler: async (r) => callService(UserService.updateName)(r),
  },
  updateLeaderboardMemory: {
    handler: async (r) => callService(UserService.updateLbMemory)(r),
  },
  getPersonalBests: {
    handler: async (r) => callService(UserService.getPersonalBests)(r),
  },
  deletePersonalBests: {
    handler: async (r) => callService(UserService.clearPb)(r),
  },
  optOutOfLeaderboards: {
    handler: async (r) => callService(UserService.optOutOfLeaderboards)(r),
  },
  addResultFilterPreset: {
    handler: async (r) => callService(UserService.addResultFilterPreset)(r),
  },
  removeResultFilterPreset: {
    handler: async (r) => callService(UserService.removeResultFilterPreset)(r),
  },
  getTags: {
    handler: async (r) => callService(UserService.getTags)(r),
  },
  createTag: {
    handler: async (r) => callService(UserService.addTag)(r),
  },
  editTag: {
    handler: async (r) => callService(UserService.editTag)(r),
  },
  deleteTag: {
    handler: async (r) => callService(UserService.removeTag)(r),
  },
  deleteTagPersonalBest: {
    handler: async (r) => callService(UserService.clearTagPb)(r),
  },
  getCustomThemes: {
    handler: async (r) => callService(UserService.getCustomThemes)(r),
  },
  addCustomTheme: {
    handler: async (r) => callService(UserService.addCustomTheme)(r),
  },
  deleteCustomTheme: {
    handler: async (r) => callService(UserService.removeCustomTheme)(r),
  },
  editCustomTheme: {
    handler: async (r) => callService(UserService.editCustomTheme)(r),
  },
  getStats: {
    handler: async (r) => callService(UserService.getStats)(r),
  },
  setStreakHourOffset: {
    handler: async (r) => callService(UserService.setStreakHourOffset)(r),
  },
  getFavoriteQuotes: {
    handler: async (r) => callService(UserService.getFavoriteQuotes)(r),
  },
  addQuoteToFavorites: {
    handler: async (r) => callService(UserService.addFavoriteQuote)(r),
  },
  removeQuoteFromFavorites: {
    handler: async (r) => callService(UserService.removeFavoriteQuote)(r),
  },
  getProfile: {
    handler: async (r) => callService(UserService.getProfile)(r),
  },
  updateProfile: {
    handler: async (r) => callService(UserService.updateProfile)(r),
  },
  getInbox: {
    handler: async (r) => callService(UserService.getInbox)(r),
  },
  updateInbox: {
    handler: async (r) => callService(UserService.updateInbox)(r),
  },
  report: {
    handler: async (r) => callService(UserService.reportUser)(r),
  },
  revokeAllTokens: {
    handler: async (r) => callService(UserService.revokeAllTokens)(r),
  },
  getTestActivity: {
    handler: async (r) => callService(UserService.getTestActivity)(r),
  },
  getCurrentTestActivity: {
    handler: async (r) => callService(UserService.getCurrentTestActivity)(r),
  },
  getStreak: {
    handler: async (r) => callService(UserService.getStreak)(r),
  },
});
