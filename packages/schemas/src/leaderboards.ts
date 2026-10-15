import { z } from "zod";

export const LeaderboardEntrySchema = z.object({
  wpm: z.number().nonnegative(),
  acc: z.number().nonnegative().min(0).max(100),
  timestamp: z.number().int().nonnegative(),
  raw: z.number().nonnegative(),
  consistency: z.number().nonnegative().optional(),
  uid: z.string(),
  name: z.string(),
  rank: z.number().nonnegative().int(),
  badgeId: z.number().int().optional(),
  isPremium: z.boolean().optional(),
});
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

export const DailyLeaderboardEntrySchema = LeaderboardEntrySchema.omit({
  rank: true,
});
export type DailyLeaderboardEntry = z.infer<typeof DailyLeaderboardEntrySchema>;

export const XpLeaderboardProfileSchema = z.object({
  uid: z.string(),
  name: z.string(),
  lastActivityTimestamp: z.number().int().nonnegative(),
  timeTypedSeconds: z.number().nonnegative(),
  // optionals
  badgeId: z.number().int().optional(),
  isPremium: z.boolean().optional(),
});
export type XpLeaderboardProfile = z.infer<typeof XpLeaderboardProfileSchema>;

export const XpLeaderboardScoreSchema = z.number().int().nonnegative();
export type XpLeaderboardScore = z.infer<typeof XpLeaderboardScoreSchema>;

export const XpLeaderboardEntrySchema = XpLeaderboardProfileSchema.extend({
  totalXp: XpLeaderboardScoreSchema,
  // dynamically added when generating response on the backend
  rank: z.number().nonnegative().int(),
});
export type XpLeaderboardEntry = z.infer<typeof XpLeaderboardEntrySchema>;
