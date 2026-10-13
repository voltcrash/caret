import {
  Configuration,
  ConfigurationFormObjectOf,
} from "@oxytype/schemas/configuration";
export { BASE_CONFIGURATION } from "@oxytype/schemas/default-configuration";

type FormSchema = ConfigurationFormObjectOf<Configuration>;

export const CONFIGURATION_FORM_SCHEMA: FormSchema = {
  type: "object",
  label: "Server Configuration",
  fields: {
    maintenance: {
      type: "boolean",
      label: "In Maintenance",
    },
    dev: {
      type: "object",
      label: "Development",
      fields: {
        responseSlowdownMs: {
          type: "number",
          label: "Response Slowdown (miliseconds)",
          min: 0,
        },
      },
    },
    results: {
      type: "object",
      label: "Results",
      fields: {
        savingEnabled: {
          type: "boolean",
          label: "Saving Results",
        },
        objectHashCheckEnabled: {
          type: "boolean",
          label: "Object Hash Check",
        },
        filterPresets: {
          type: "object",
          label: "Filter Presets",
          fields: {
            enabled: {
              type: "boolean",
              label: "Enabled",
            },
            maxPresetsPerUser: {
              type: "number",
              label: "Max Presets Per User",
              min: 0,
            },
          },
        },
        limits: {
          type: "object",
          label: "maximum results",
          fields: {
            regularUser: {
              type: "number",
              label: "for regular users",
              min: 0,
            },
            premiumUser: {
              type: "number",
              label: "for premium users",
              min: 0,
            },
          },
        },
        maxBatchSize: {
          type: "number",
          label: "results endpoint max batch size",
          min: 1,
        },
      },
    },
    quotes: {
      type: "object",
      label: "Quotes",
      fields: {
        reporting: {
          type: "object",
          label: "Reporting",
          fields: {
            enabled: {
              type: "boolean",
              label: "Enabled",
            },
            maxReports: {
              type: "number",
              label: "Max Reports",
            },
            contentReportLimit: {
              type: "number",
              label: "Content Report Limit",
            },
          },
        },
        submissionsEnabled: {
          type: "boolean",
          label: "Submissions Enabled",
        },
        maxFavorites: {
          type: "number",
          label: "Max Favorites",
        },
      },
    },
    admin: {
      type: "object",
      label: "Admin",
      fields: {
        endpointsEnabled: {
          type: "boolean",
          label: "Endpoints Enabled",
        },
      },
    },
    apeKeys: {
      type: "object",
      label: "Ape Keys",
      fields: {
        endpointsEnabled: {
          type: "boolean",
          label: "Endpoints Enabled",
        },
        acceptKeys: {
          type: "boolean",
          label: "Accept Keys",
        },
        maxKeysPerUser: {
          type: "number",
          label: "Max Keys Per User",
          min: 0,
        },
        apeKeyBytes: {
          type: "number",
          label: "Ape Key Bytes",
          min: 24,
        },
      },
    },
    users: {
      type: "object",
      label: "Users",
      fields: {
        premium: {
          type: "object",
          label: "Premium",
          fields: {
            enabled: {
              type: "boolean",
              label: "Enabled",
            },
          },
        },
        signUp: {
          type: "boolean",
          label: "Sign Up Enabled",
        },
        xp: {
          type: "object",
          label: "XP",
          fields: {
            enabled: {
              type: "boolean",
              label: "Enabled",
            },
            gainMultiplier: {
              type: "number",
              label: "Gain Multiplier",
            },
            funboxBonus: {
              type: "number",
              label: "Funbox Bonus",
            },
            maxDailyBonus: {
              type: "number",
              label: "Max Daily Bonus",
            },
            minDailyBonus: {
              type: "number",
              label: "Min Daily Bonus",
            },
            streak: {
              type: "object",
              label: "Streak",
              fields: {
                enabled: {
                  type: "boolean",
                  label: "Enabled",
                },
                maxStreakDays: {
                  type: "number",
                  label: "Max Streak Days",
                },
                maxStreakMultiplier: {
                  type: "number",
                  label: "Max Streak Multiplier",
                },
              },
            },
          },
        },
        autoBan: {
          type: "object",
          label: "Auto Ban",
          fields: {
            enabled: {
              type: "boolean",
              label: "Enabled",
            },
            maxCount: {
              type: "number",
              label: "Max Count",
              min: 0,
            },
            maxHours: {
              type: "number",
              label: "Max Hours",
              min: 0,
            },
          },
        },
        inbox: {
          type: "object",
          label: "Inbox",
          fields: {
            enabled: {
              type: "boolean",
              label: "Enabled",
            },
            maxMail: {
              type: "number",
              label: "Max Messages",
              min: 0,
            },
          },
        },
        profiles: {
          type: "object",
          label: "User Profiles",
          fields: {
            enabled: {
              type: "boolean",
              label: "Enabled",
            },
          },
        },
      },
    },
    rateLimiting: {
      type: "object",
      label: "Rate Limiting",
      fields: {
        badAuthentication: {
          type: "object",
          label: "Bad Authentication Rate Limiter",
          fields: {
            enabled: {
              type: "boolean",
              label: "Enabled",
            },
            penalty: {
              type: "number",
              label: "Penalty",
              min: 0,
            },
            flaggedStatusCodes: {
              type: "array",
              label: "Flagged Status Codes",
              items: {
                label: "Status Code",
                type: "number",
                min: 0,
              },
            },
          },
        },
      },
    },
    dailyLeaderboards: {
      type: "object",
      label: "Daily Leaderboards",
      fields: {
        enabled: {
          type: "boolean",
          label: "Enabled",
        },
        maxResults: {
          type: "number",
          label: "Max Results",
          min: 0,
        },
        leaderboardExpirationTimeInDays: {
          type: "number",
          label: "Leaderboard Expiration Time In Days",
          min: 0,
          hint: "This should atleast be 2, to allow for previous day queries.",
        },
        validModeRules: {
          type: "array",
          label: "Valid Mode Rules",
          items: {
            type: "object",
            label: "Rule",
            fields: {
              language: {
                type: "string",
                label: "Language",
              },
              mode: {
                type: "string",
                label: "Mode",
              },
              mode2: {
                type: "string",
                label: "Secondary Mode",
              },
            },
          },
        },
        scheduleRewardsModeRules: {
          type: "array",
          label: "Schedule Rewards Mode Rules",
          items: {
            type: "object",
            label: "Rule",
            fields: {
              language: {
                type: "string",
                label: "Language",
              },
              mode: {
                type: "string",
                label: "Mode",
              },
              mode2: {
                type: "string",
                label: "Secondary Mode",
              },
            },
          },
        },
        xpRewardBrackets: {
          type: "array",
          label: "XP Reward Brackets",
          items: {
            type: "object",
            label: "Bracket",
            fields: {
              minRank: {
                type: "number",
                label: "Min Rank",
                min: 1,
              },
              maxRank: {
                type: "number",
                label: "Max Rank",
                min: 1,
              },
              minReward: {
                type: "number",
                label: "Min Reward",
                min: 0,
              },
              maxReward: {
                type: "number",
                label: "Max Reward",
                min: 0,
              },
            },
          },
        },
      },
    },
    leaderboards: {
      type: "object",
      label: "Leaderboards",
      fields: {
        minTimeTyping: {
          type: "number",
          label: "Minimum typing time the user needs to get on a leaderboard",
          hint: "Typing time in seconds. Change is only applied after restarting the server.",
          min: 0,
        },
        weeklyXp: {
          type: "object",
          label: "Weekly XP",
          fields: {
            enabled: {
              type: "boolean",
              label: "Enabled",
            },
            expirationTimeInDays: {
              type: "number",
              label: "Expiration time in days",
              min: 0,
              hint: "This should atleast be 15, to allow for past week queries.",
            },
            xpRewardBrackets: {
              type: "array",
              label: "XP Reward Brackets",
              items: {
                type: "object",
                label: "Bracket",
                fields: {
                  minRank: {
                    type: "number",
                    label: "Min Rank",
                    min: 1,
                  },
                  maxRank: {
                    type: "number",
                    label: "Max Rank",
                    min: 1,
                  },
                  minReward: {
                    type: "number",
                    label: "Min Reward",
                    min: 0,
                  },
                  maxReward: {
                    type: "number",
                    label: "Max Reward",
                    min: 0,
                  },
                },
              },
            },
          },
        },
      },
    },
    anticheat: {
      type: "object",
      label: "Anticheat",
      fields: {
        botCheckMinWpm: {
          type: "number",
          label: "Bot Check Min WPM",
          min: 0,
          hint: "Time tests above this speed need key timings and are checked for a fixed timing signature.",
        },
        review: {
          type: "object",
          label: "Review Signals",
          fields: {
            enabled: {
              type: "boolean",
              label: "Enabled",
              hint: "Log statistical timing signals for review. Never rejects results.",
            },
            minWpm: {
              type: "number",
              label: "Min WPM",
              min: 0,
            },
            suspiciousAfterFlags: {
              type: "number",
              label: "Suspicious After Flags",
              min: 0,
              hint: "Mark users suspicious (extra review logs, no penalty) after this many flagged results. 0 disables.",
            },
            suspiciousWindowHours: {
              type: "number",
              label: "Suspicious Window (hours)",
              min: 0,
            },
          },
        },
        samples: {
          type: "object",
          label: "Timing Samples",
          fields: {
            captureFlagged: {
              type: "boolean",
              label: "Capture Flagged",
              hint: "Store raw key timings of flagged results in audit logs.",
            },
            randomRate: {
              type: "number",
              label: "Random Capture Rate",
              min: 0,
              hint: "Fraction (0-1) of reviewed results whose raw key timings are stored as a baseline.",
            },
          },
        },
        replayCheck: {
          type: "object",
          label: "Replay Check",
          fields: {
            enabled: {
              type: "boolean",
              label: "Enabled",
              hint: "Reject results that resubmit one of the user's recent key timelines.",
            },
            maxFingerprints: {
              type: "number",
              label: "Max Fingerprints",
              min: 0,
            },
          },
        },
      },
    },
  },
};
