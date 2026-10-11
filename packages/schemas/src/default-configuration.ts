import type { Configuration } from "@oxytype/schemas/configuration";

/**
 * This is the base schema for the configuration of the API backend.
 * To add a new configuration. Simply add it to this object.
 * When changing this template, please follow the principle of "Secure by default" (https://en.wikipedia.org/wiki/Secure_by_default).
 */
export const BASE_CONFIGURATION: Configuration = {
  maintenance: false,
  dev: {
    responseSlowdownMs: 0,
  },
  results: {
    savingEnabled: false,
    objectHashCheckEnabled: false,
    filterPresets: {
      enabled: false,
      maxPresetsPerUser: 0,
    },
    limits: {
      regularUser: 1000,
      premiumUser: 10000,
    },
    maxBatchSize: 1000,
  },
  quotes: {
    reporting: {
      enabled: false,
      maxReports: 0,
      contentReportLimit: 0,
    },
    submissionsEnabled: false,
    maxFavorites: 0,
  },
  admin: {
    endpointsEnabled: false,
  },
  apeKeys: {
    endpointsEnabled: false,
    acceptKeys: false,
    maxKeysPerUser: 0,
    apeKeyBytes: 24,
  },
  users: {
    signUp: false,
    autoBan: {
      enabled: false,
      maxCount: 5,
      maxHours: 1,
    },
    profiles: {
      enabled: false,
    },
    xp: {
      enabled: true,
      funboxBonus: 0.1,
      gainMultiplier: 1,
      maxDailyBonus: 1000,
      minDailyBonus: 100,
      streak: {
        enabled: true,
        maxStreakDays: 100,
        maxStreakMultiplier: 2,
      },
    },
    inbox: {
      enabled: false,
      maxMail: 0,
    },
    premium: {
      enabled: false,
    },
  },
  rateLimiting: {
    badAuthentication: {
      enabled: false,
      penalty: 0,
      flaggedStatusCodes: [],
    },
  },
  dailyLeaderboards: {
    enabled: true,
    maxResults: 1000,
    leaderboardExpirationTimeInDays: 2, // This should atleast be 2
    validModeRules: [{ language: "english", mode: "time", mode2: "(15|60)" }],
    scheduleRewardsModeRules: [
      { language: "english", mode: "time", mode2: "(15|60)" },
    ],
    xpRewardBrackets: [
      { minRank: 1, maxRank: 1, minReward: 5000, maxReward: 5000 },
      { minRank: 2, maxRank: 10, minReward: 1000, maxReward: 2500 },
      { minRank: 11, maxRank: 100, minReward: 100, maxReward: 900 },
    ],
  },
  leaderboards: {
    minTimeTyping: 2 * 60 * 60,
    weeklyXp: {
      enabled: true,
      expirationTimeInDays: 15, // This should atleast be 15
      xpRewardBrackets: [],
    },
  },
  anticheat: {
    botCheckMinWpm: 130,
    // Review signals only write audit logs; they never reject a result.
    review: {
      enabled: true,
      minWpm: 100,
      // suspicious only adds review logs for the user's later results
      suspiciousAfterFlags: 5,
      suspiciousWindowHours: 7 * 24,
    },
    // Raw key timings are behavioural data. Keep capture off unless reviewing.
    samples: {
      captureFlagged: false,
      randomRate: 0,
    },
    // A long, varied key timeline cannot repeat by chance.
    replayCheck: {
      enabled: true,
      maxFingerprints: 50,
    },
  },
};
