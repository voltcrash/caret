import { z, ZodOptional } from "zod";
import {
  IdSchema,
  nameWithSeparators,
  partialRecord,
  slug,
  StringNumberSchema,
} from "./util";
import { LanguageSchema } from "./languages";
import {
  ModeSchema,
  Mode2Schema,
  PersonalBestsSchema,
  DefaultWordsModeSchema,
  DefaultTimeModeSchema,
  QuoteLengthSchema,
  DifficultySchema,
} from "./shared";
import { CustomThemeColorsSchema, FunboxNameSchema } from "./configs";
import { doesNotContainDisallowedWords } from "./validation/validation";

export const ResultFilterPresetNameSchema = slug().max(16);

const NoneFilterSchema = z.literal("none");
export const ResultFiltersSchema = z.object({
  _id: IdSchema,
  name: ResultFilterPresetNameSchema,
  pb: z
    .object({
      no: z.boolean(),
      yes: z.boolean(),
    })
    .strict(),
  difficulty: partialRecord(DifficultySchema, z.boolean()),
  mode: partialRecord(ModeSchema, z.boolean()),
  words: partialRecord(
    DefaultWordsModeSchema.or(z.literal("custom")),
    z.boolean(),
  ),
  time: partialRecord(
    DefaultTimeModeSchema.or(z.literal("custom")),
    z.boolean(),
  ),
  quoteLength: partialRecord(QuoteLengthSchema, z.boolean()),
  punctuation: z
    .object({
      on: z.boolean(),
      off: z.boolean(),
    })
    .strict(),
  numbers: z
    .object({
      on: z.boolean(),
      off: z.boolean(),
    })
    .strict(),
  date: z
    .object({
      last_day: z.boolean(),
      last_week: z.boolean(),
      last_month: z.boolean(),
      last_3months: z.boolean(),
      all: z.boolean(),
    })
    .strict(),
  tags: z.record(IdSchema.or(NoneFilterSchema), z.boolean()),
  language: partialRecord(LanguageSchema, z.boolean()),
  funbox: partialRecord(FunboxNameSchema.or(NoneFilterSchema), z.boolean()),
});
export type ResultFilters = z.infer<typeof ResultFiltersSchema>;
export type ResultFiltersKeys = keyof Omit<ResultFilters, "_id" | "name">;

export const StreakHourOffsetSchema = z
  .number()
  .min(-11)
  .max(12)
  .multipleOf(0.5);
export type StreakHourOffset = z.infer<typeof StreakHourOffsetSchema>;

export const UserStreakSchema = z
  .object({
    lastResultTimestamp: z.number().int().nonnegative(),
    length: z.number().int().nonnegative(),
    maxLength: z.number().int().nonnegative(),
    hourOffset: StreakHourOffsetSchema.optional(),
  })
  .strict();
export type UserStreak = z.infer<typeof UserStreakSchema>;
export const TagNameSchema = nameWithSeparators().max(16);
export type TagName = z.infer<typeof TagNameSchema>;

export const UserTagSchema = z
  .object({
    _id: IdSchema,
    name: TagNameSchema,
    personalBests: PersonalBestsSchema,
  })
  .strict();
export type UserTag = z.infer<typeof UserTagSchema>;

function profileDetailsBase<T extends z.ZodType<string, string>>(
  schema: T,
): ZodOptional<
  z.ZodPipe<
    ZodOptional<T>,
    z.ZodTransform<string | undefined, string | undefined>
  >
> {
  return (
    doesNotContainDisallowedWords("word", schema)
      .optional()
      .transform((value) => (value === null ? undefined : value))
      // Zod 4 only marks keys optional when the output schema is optional.
      .optional()
  );
}

export const TwitterProfileSchema = profileDetailsBase(slug().max(15)).or(
  z.literal(""),
);

export const GithubProfileSchema = profileDetailsBase(slug().max(39)).or(
  z.literal(""),
);

export const WebsiteSchema = profileDetailsBase(
  z.url().max(200).startsWith("https://"),
).or(z.literal(""));

export const UserProfileDetailsSchema = z
  .object({
    bio: profileDetailsBase(z.string().max(250)).or(z.literal("")),
    keyboard: profileDetailsBase(z.string().max(75)).or(z.literal("")),
    socialProfiles: z
      .object({
        twitter: TwitterProfileSchema,
        github: GithubProfileSchema,
        website: WebsiteSchema,
      })
      .strict()
      .optional(),
    showActivityOnPublicProfile: z.boolean().optional(),
  })
  .strict();
export type UserProfileDetails = z.infer<typeof UserProfileDetailsSchema>;

export const CustomThemeNameSchema = nameWithSeparators().max(16);
export type CustomThemeName = z.infer<typeof CustomThemeNameSchema>;

export const CustomThemeSchema = z
  .object({
    _id: IdSchema,
    name: CustomThemeNameSchema,
    colors: CustomThemeColorsSchema,
  })
  .strict();
export type CustomTheme = z.infer<typeof CustomThemeSchema>;

export const PremiumInfoSchema = z.object({
  startTimestamp: z.number().int().nonnegative(),
  expirationTimestamp: z
    .number()
    .int()
    .nonnegative()
    .or(z.literal(-1).describe("lifetime premium")),
});
export type PremiumInfo = z.infer<typeof PremiumInfoSchema>;

export const UserQuoteRatingsSchema = partialRecord(
  LanguageSchema,
  z.record(
    StringNumberSchema.describe("quoteId as string"),
    z.number().nonnegative(),
  ),
);
export type UserQuoteRatings = z.infer<typeof UserQuoteRatingsSchema>;

export const UserLbMemorySchema = partialRecord(
  ModeSchema,
  z.record(
    Mode2Schema,
    partialRecord(LanguageSchema, z.number().int().nonnegative()),
  ),
);
export type UserLbMemory = z.infer<typeof UserLbMemorySchema>;

export const RankAndCountSchema = z.object({
  rank: z.number().int().nonnegative().optional(),
  count: z.number().int().nonnegative(),
});
export type RankAndCount = z.infer<typeof RankAndCountSchema>;

export const AllTimeLbsSchema = z.object({
  time: z.record(
    Mode2Schema,
    partialRecord(LanguageSchema, RankAndCountSchema.optional()),
  ),
});
export type AllTimeLbs = z.infer<typeof AllTimeLbsSchema>;

export const BadgeSchema = z
  .object({
    id: z.number().int().nonnegative(),
    selected: z.boolean().optional(),
  })
  .strict();
export type Badge = z.infer<typeof BadgeSchema>;

export const UserInventorySchema = z
  .object({
    badges: z.array(BadgeSchema),
  })
  .strict();
export type UserInventory = z.infer<typeof UserInventorySchema>;

export const QuoteModSchema = z
  .boolean()
  .describe("Admin for all languages if true")
  .or(LanguageSchema.describe("Admin for the given language"))
  // Zod 3 carried the first option's description onto the union.
  .describe("Admin for all languages if true");
export type QuoteMod = z.infer<typeof QuoteModSchema>;

export const TestActivitySchema = z
  .object({
    testsByDays: z
      .array(z.number().int().nonnegative().or(z.null()))
      .describe(
        "Number of tests by day. Last element of the array is on the date `lastDay`. `null` means no tests on that day.",
      ),
    lastDay: z
      .number()
      .int()
      .nonnegative()
      .describe("Timestamp of the last day included in the test activity"),
  })
  .strict();
export type TestActivity = z.infer<typeof TestActivitySchema>;

export const CountByYearAndDaySchema = z.record(
  StringNumberSchema.describe("year"),
  z.array(
    z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .describe(
        "number of tests, position in the array is the day of the year",
      ),
  ),
);
export type CountByYearAndDay = z.infer<typeof CountByYearAndDaySchema>;

//Record<language, array with quoteIds as string
export const FavoriteQuotesSchema = partialRecord(
  LanguageSchema,
  z.array(StringNumberSchema),
);
export type FavoriteQuotes = z.infer<typeof FavoriteQuotesSchema>;

export const UserEmailSchema = z.email();

/**
 * username schema without profanity check
 */
export const UserNameWithoutFilterSchema = slug().min(1).max(16);

/**
 * username schema with profanity check
 */
export const UserNameSchema = doesNotContainDisallowedWords(
  "substring",
  UserNameWithoutFilterSchema,
);

export const UserSchema = z.object({
  name: UserNameSchema,
  email: UserEmailSchema,
  uid: z.string(), //defined by the authentication service, no validation should be applied
  addedAt: z.number().int().nonnegative(),
  personalBests: PersonalBestsSchema,
  completedTests: z.number().int().nonnegative().optional(),
  startedTests: z.number().int().nonnegative().optional(),
  timeTyping: z
    .number()
    .nonnegative()
    .optional()
    .describe("time typing in seconds"),
  streak: UserStreakSchema.optional(),
  xp: z.number().int().nonnegative().optional(),
  tags: z.array(UserTagSchema).optional(),
  profileDetails: UserProfileDetailsSchema.optional(),
  customThemes: z.array(CustomThemeSchema).optional(),
  premium: PremiumInfoSchema.optional(),
  isPremium: z.boolean().optional(),
  quoteRatings: UserQuoteRatingsSchema.optional(),
  favoriteQuotes: FavoriteQuotesSchema.optional(),
  lbMemory: UserLbMemorySchema.optional(),
  allTimeLbs: AllTimeLbsSchema,
  inventory: UserInventorySchema.optional(),
  banned: z.boolean().optional(),
  lbOptOut: z.boolean().optional(),
  verified: z.boolean().optional(),
  needsToChangeName: z.boolean().optional(),
  quoteMod: QuoteModSchema.optional(),
  resultFilterPresets: z.array(ResultFiltersSchema).optional(),
  testActivity: TestActivitySchema.optional(),
});
export type User = z.infer<typeof UserSchema>;

export type ResultFiltersGroup = keyof ResultFilters;

export type ResultFiltersGroupItem<T extends ResultFiltersGroup> =
  keyof ResultFilters[T];

export const TypingStatsSchema = z.object({
  completedTests: z.number().int().nonnegative().optional(),
  startedTests: z.number().int().nonnegative().optional(),
  timeTyping: z.number().int().nonnegative().optional(),
});
export type TypingStats = z.infer<typeof TypingStatsSchema>;

export const UserProfileSchema = UserSchema.pick({
  uid: true,
  name: true,
  banned: true,
  addedAt: true,
  xp: true,
  lbOptOut: true,
  isPremium: true,
  inventory: true,
  allTimeLbs: true,
  testActivity: true,
})
  .extend({
    typingStats: TypingStatsSchema,
    personalBests: PersonalBestsSchema.pick({ time: true, words: true }),
    streak: z.number().int().nonnegative(),
    maxStreak: z.number().int().nonnegative(),
    details: UserProfileDetailsSchema,
  })
  .partial({
    //omitted for banned users
    inventory: true,
    details: true,
    allTimeLbs: true,
    uid: true,
  });
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const ReportUserReasonSchema = z.enum([
  "Inappropriate name",
  "Inappropriate bio",
  "Inappropriate social links",
  "Suspected cheating",
]);
export type ReportUserReason = z.infer<typeof ReportUserReasonSchema>;

export const ReportUserCommentSchema = z
  .string()
  .regex(/^([.]|[^/<>])+$/)
  .max(250)
  .optional()
  .or(z.string().length(0));
