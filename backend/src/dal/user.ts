export type { DBUser, DBUserTag, DBCustomTheme } from "./user/types";
export {
  getUser,
  getPartialUser,
  findByName,
  isNameAvailable,
  getUserByName,
} from "./user/queries";
export {
  addUser,
  exists,
  resetUser,
  updateName,
  flagForNameChange,
  setBanned,
  checkIfUserIsPremium,
  logIpAddress,
} from "./user/account";
export {
  clearPb,
  optOutOfLeaderboards,
  updateLbMemory,
  checkIfPb,
  checkIfTagPb,
  getPersonalBests,
} from "./user/personal-bests";
export { addTag, getTags, editTag, removeTag, removeTagPb } from "./user/tags";
export {
  updateQuoteRatings,
  addResultFilterPreset,
  removeResultFilterPreset,
  addTheme,
  removeTheme,
  editTheme,
  getThemes,
  getFavoriteQuotes,
  addFavoriteQuote,
  removeFavoriteQuote,
  updateProfile,
} from "./user/preferences";
export {
  setSuspicious,
  clearSuspicious,
  updateLastTimingHashes,
  updateTypingStats,
  incrementBananas,
  incrementXp,
  incrementTestActivity,
  recordAutoBanEvent,
  updateStreak,
  setStreakHourOffset,
  clearStreakHourOffset,
  getStats,
} from "./user/progression";
export { getInbox, addToInbox, updateInbox } from "./user/inbox";
