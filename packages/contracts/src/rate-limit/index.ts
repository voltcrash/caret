export type Window = "second" | "minute" | "hour" | "day" | number;
export type RateLimitOptions = {
  /** Timeframe or time in milliseconds */
  window: Window;
  /** Max request within the given window */
  max: number;
};

export const limits = {
  adminLimit: {
    window: 5000, // 5 seconds
    max: 1,
  },

  // Config Routing
  configUpdate: {
    window: "hour",
    max: 500,
  },

  configGet: {
    window: "hour",
    max: 120,
  },

  configDelete: {
    window: "hour",
    max: 120,
  },

  // Leaderboards Routing
  leaderboardsGet: {
    window: "hour",
    max: 500,
  },

  // New Quotes Routing
  newQuotesGet: {
    window: "hour",
    max: 500,
  },

  newQuotesIsSubmissionEnabled: {
    window: "minute",
    max: 60,
  },

  newQuotesAdd: {
    window: "hour",
    max: 60,
  },

  newQuotesAction: {
    window: "hour",
    max: 500,
  },

  // Quote Ratings Routing
  quoteRatingsGet: {
    window: "hour",
    max: 500,
  },

  quoteRatingsSubmit: {
    window: "hour",
    max: 500,
  },

  // Quote reporting
  quoteReportSubmit: {
    window: 30 * 60 * 1000, // 30 minutes
    max: 50,
  },

  // Quote favorites
  quoteFavoriteGet: {
    window: 30 * 60 * 1000, // 30 minutes
    max: 50,
  },

  quoteFavoritePost: {
    window: 30 * 60 * 1000, // 30 minutes
    max: 50,
  },

  quoteFavoriteDelete: {
    window: 30 * 60 * 1000, // 30 minutes
    max: 50,
  },

  // Presets Routing
  presetsGet: {
    window: "hour",
    max: 60,
  },

  presetsAdd: {
    window: "hour",
    max: 60,
  },

  presetsRemove: {
    window: "hour",
    max: 60,
  },

  presetsEdit: {
    window: "hour",
    max: 60,
  },

  // PSA (Public Service Announcement) Routing
  psaGet: {
    window: "minute",
    max: 60,
  },

  // Get public speed stats
  publicStatsGet: {
    window: "minute",
    max: 60,
  },

  // Results Routing
  resultsGet: {
    window: "hour",
    max: 60,
  },

  // Results Routing

  // Result by id
  resultByIdGet: {
    window: "hour",
    max: 300,
  },

  // Result by id

  resultsAdd: {
    window: "hour",
    max: 300,
  },

  resultsTagsUpdate: {
    window: "hour",
    max: 100,
  },

  resultsLeaderboardGet: {
    window: "hour",
    max: 60,
  },

  resultsLeaderboardQualificationGet: {
    window: "hour",
    max: 60,
  },

  // Users Routing
  userGet: {
    window: "hour",
    max: 60,
  },

  setStreakHourOffset: {
    window: "hour",
    max: 5,
  },

  userSignup: {
    window: "day",
    max: 2,
  },

  userDelete: {
    window: "day",
    max: 3,
  },

  userReset: {
    window: "day",
    max: 3,
  },

  userCheckName: {
    window: "minute",
    max: 60,
  },

  userUpdateName: {
    window: "day",
    max: 3,
  },

  userUpdateLBMemory: {
    window: "minute",
    max: 60,
  },

  userClearPB: {
    window: "hour",
    max: 60,
  },

  userOptOutOfLeaderboards: {
    window: "hour",
    max: 10,
  },

  userCustomFilterAdd: {
    window: "hour",
    max: 60,
  },

  userCustomFilterRemove: {
    window: "hour",
    max: 60,
  },

  userTagsGet: {
    window: "hour",
    max: 60,
  },

  userTagsRemove: {
    window: "hour",
    max: 30,
  },

  userTagsClearPB: {
    window: "hour",
    max: 60,
  },

  userTagsEdit: {
    window: "hour",
    max: 30,
  },

  userTagsAdd: {
    window: "hour",
    max: 30,
  },

  userCustomThemeGet: {
    window: "hour",
    max: 30,
  },

  userCustomThemeAdd: {
    window: "hour",
    max: 30,
  },

  userCustomThemeRemove: {
    window: "hour",
    max: 30,
  },

  userCustomThemeEdit: {
    window: "hour",
    max: 30,
  },

  userRevokeAllTokens: {
    window: "hour",
    max: 10,
  },

  userProfileGet: {
    window: "hour",
    max: 100,
  },

  userProfileUpdate: {
    window: "hour",
    max: 60,
  },

  userTestActivity: {
    window: "hour",
    max: 60,
  },

  userCurrentTestActivity: {
    window: "hour",
    max: 60,
  },

  userStreak: {
    window: "hour",
    max: 60,
  },
} satisfies Record<string, RateLimitOptions>;

export type RateLimiterId = keyof typeof limits;
