import { z } from "zod";

/* ValidModeRuleSchema allows complex rules like `"mode2": "(15|60)"`. We don't want a strict validation here. */
export const ValidModeRuleSchema = z
  .object({
    language: z.string(),
    mode: z.string(),
    mode2: z.string(),
  })
  .strict();
export type ValidModeRule = z.infer<typeof ValidModeRuleSchema>;

export const ConfigurationSchema = z.object({
  maintenance: z.boolean(),
  dev: z.object({
    responseSlowdownMs: z.number().int().nonnegative(),
  }),
  quotes: z.object({
    reporting: z.object({
      enabled: z.boolean(),
      maxReports: z.number().int().nonnegative(),
      contentReportLimit: z.number().int().nonnegative(),
    }),
    submissionsEnabled: z.boolean(),
    maxFavorites: z.number().int().nonnegative(),
  }),
  results: z.object({
    savingEnabled: z.boolean(),
    objectHashCheckEnabled: z.boolean(),
    filterPresets: z.object({
      enabled: z.boolean(),
      maxPresetsPerUser: z.number().int().nonnegative(),
    }),
    limits: z.object({
      regularUser: z.number().int().nonnegative(),
      premiumUser: z.number().int().nonnegative(),
    }),
    maxBatchSize: z.number().int().nonnegative(),
  }),
  users: z.object({
    signUp: z.boolean(),
    autoBan: z.object({
      enabled: z.boolean(),
      maxCount: z.number().int().nonnegative(),
      maxHours: z.number().int().nonnegative(),
    }),
    profiles: z.object({
      enabled: z.boolean(),
    }),
    xp: z.object({
      enabled: z.boolean(),
      funboxBonus: z.number(),
      gainMultiplier: z.number(),
      maxDailyBonus: z.number(),
      minDailyBonus: z.number(),
      streak: z.object({
        enabled: z.boolean(),
        maxStreakDays: z.number().nonnegative(),
        maxStreakMultiplier: z.number(),
      }),
    }),
    premium: z.object({
      enabled: z.boolean(),
    }),
  }),
  admin: z.object({
    endpointsEnabled: z.boolean(),
  }),

  rateLimiting: z.object({
    badAuthentication: z.object({
      enabled: z.boolean(),
      penalty: z.number(),
      flaggedStatusCodes: z.array(z.number().int().nonnegative()),
    }),
  }),
  dailyLeaderboards: z.object({
    enabled: z.boolean(),
    leaderboardExpirationTimeInDays: z.number().nonnegative(),
    maxResults: z.number().int().nonnegative(),
    validModeRules: z.array(ValidModeRuleSchema),
  }),
  leaderboards: z.object({
    minTimeTyping: z
      .number()
      .min(0)
      .describe(
        "Minimum typing time (in seconds) the user needs to get on a leaderboard",
      ),
    weeklyXp: z.object({
      enabled: z.boolean(),
      expirationTimeInDays: z.number().nonnegative(),
    }),
  }),
  anticheat: z.object({
    botCheckMinWpm: z
      .number()
      .nonnegative()
      .describe(
        "Time tests above this WPM must include key timings and pass the fixed timing check",
      ),
    review: z.object({
      enabled: z.boolean(),
      minWpm: z.number().nonnegative(),
      suspiciousAfterFlags: z
        .number()
        .int()
        .nonnegative()
        .describe(
          "Mark a user suspicious after this many flagged results in the window. 0 disables.",
        ),
      suspiciousWindowHours: z.number().int().nonnegative(),
    }),
    samples: z.object({
      captureFlagged: z.boolean(),
      randomRate: z.number().min(0).max(1),
    }),
    replayCheck: z.object({
      enabled: z.boolean(),
      maxFingerprints: z.number().int().nonnegative(),
    }),
    logVerification: z.object({
      enabled: z
        .boolean()
        .describe(
          "Replay attached event logs and reject results whose metrics disagree",
        ),
    }),
  }),
});
export type Configuration = z.infer<typeof ConfigurationSchema>;

/* Describes the configuration fields for the admin configuration editor. */
type ConfigurationFormBase = {
  label?: string;
  hint?: string;
};
export type ConfigurationFormNumber = ConfigurationFormBase & {
  type: "number";
  min?: number;
};
export type ConfigurationFormBoolean = ConfigurationFormBase & {
  type: "boolean";
};
export type ConfigurationFormString = ConfigurationFormBase & {
  type: "string";
};
export type ConfigurationFormArray = ConfigurationFormBase & {
  type: "array";
  items: ConfigurationFormField;
};
export type ConfigurationFormObject = ConfigurationFormBase & {
  type: "object";
  fields: Record<string, ConfigurationFormField>;
};
export type ConfigurationFormField =
  | ConfigurationFormNumber
  | ConfigurationFormBoolean
  | ConfigurationFormString
  | ConfigurationFormArray
  | ConfigurationFormObject;

const ConfigurationFormBaseSchema = z.object({
  label: z.string().optional(),
  hint: z.string().optional(),
});

export const ConfigurationFormObjectSchema: z.ZodType<ConfigurationFormObject> =
  ConfigurationFormBaseSchema.extend({
    type: z.literal("object"),
    fields: z.record(
      z.string(),
      z.lazy(() => ConfigurationFormFieldSchema),
    ),
  }).strict();

export const ConfigurationFormFieldSchema: z.ZodType<ConfigurationFormField> =
  z.union([
    ConfigurationFormBaseSchema.extend({
      type: z.literal("number"),
      min: z.number().optional(),
    }).strict(),
    ConfigurationFormBaseSchema.extend({ type: z.literal("boolean") }).strict(),
    ConfigurationFormBaseSchema.extend({ type: z.literal("string") }).strict(),
    ConfigurationFormBaseSchema.extend({
      type: z.literal("array"),
      items: z.lazy(() => ConfigurationFormFieldSchema),
    }).strict(),
    z.lazy(() => ConfigurationFormObjectSchema),
  ]);

/* Form fields typed against the shape of T, so every configuration value is described. */
export type ConfigurationFormFields<T> = {
  [P in keyof T]: T[P] extends unknown[]
    ? ConfigurationFormArray & { items: ConfigurationFormFields<T[P]>[number] }
    : T[P] extends number
      ? ConfigurationFormNumber
      : T[P] extends boolean
        ? ConfigurationFormBoolean
        : T[P] extends string
          ? ConfigurationFormString
          : T[P] extends object
            ? ConfigurationFormObjectOf<T[P]>
            : never;
};
export type ConfigurationFormObjectOf<T> = ConfigurationFormObject & {
  fields: ConfigurationFormFields<T>;
};
