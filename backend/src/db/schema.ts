// Column-builder return types must retain Drizzle's inferred column metadata.
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  jsonb,
  bigint,
  boolean,
  timestamp,
  doublePrecision,
  index,
  uniqueIndex,
  primaryKey,
  check,
} from "drizzle-orm/pg-core";
import type { DBUser } from "../dal/user/types";

const id = () => text("id").primaryKey();
const json = <T = Record<string, unknown>>(name = "data") =>
  jsonb(name).$type<T>().notNull();
const date = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date", precision: 3 }).notNull();
const integer = (name: string) => bigint(name, { mode: "number" });

// Better Auth 1.7.7 core schema + this application's additional fields/model names.
export const authUsers = pgTable("auth_users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  disabled: boolean("disabled").notNull().default(false),
  createdAt: date("created_at"),
  updatedAt: date("updated_at"),
});
export const authSessions = pgTable(
  "auth_sessions",
  {
    id: id(),
    token: text("token").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    expiresAt: date("expires_at"),
    createdAt: date("created_at"),
    updatedAt: date("updated_at"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
  },
  (t) => [
    index("auth_sessions_user_idx").on(t.userId),
    index("auth_sessions_expiry_idx").on(t.expiresAt),
  ],
);
export const authAccounts = pgTable(
  "auth_accounts",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
      mode: "date",
      precision: 3,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
      mode: "date",
      precision: 3,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: date("created_at"),
    updatedAt: date("updated_at"),
  },
  (t) => [
    uniqueIndex("auth_accounts_provider_idx").on(t.providerId, t.accountId),
    index("auth_accounts_user_idx").on(t.userId),
  ],
);
export const authVerifications = pgTable(
  "auth_verifications",
  {
    id: id(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: date("expires_at"),
    createdAt: date("created_at"),
    updatedAt: date("updated_at"),
  },
  (t) => [
    index("auth_verifications_identifier_idx").on(t.identifier),
    index("auth_verifications_expiry_idx").on(t.expiresAt),
  ],
);
// Auth can exist before application registration; do not require an app row for sessions.
export const users = pgTable("users", {
  uid: text("uid").primaryKey(),
  id: text("id").notNull().unique(),
  name: text("name").notNull(),
  nameKey: text("name_key").notNull().unique(),
  email: text("email").notNull(),
  addedAt: integer("added_at").notNull(),
  xp: integer("xp").notNull().default(0),
  timeTyping: doublePrecision("time_typing").notNull().default(0),
  completedTests: integer("completed_tests").notNull().default(0),
  startedTests: integer("started_tests").notNull().default(0),
  banned: boolean("banned").notNull().default(false),
  lbOptOut: boolean("lb_opt_out").notNull().default(false),
  needsToChangeName: boolean("needs_to_change_name").notNull().default(false),
  version: integer("version").notNull().default(0),
  data: json<DBUser>(),
});
const owner = () =>
  text("uid")
    .notNull()
    .references(() => users.uid, { onDelete: "cascade" });
export const configs = pgTable("configs", {
  uid: owner().primaryKey(),
  id: text("id").notNull(),
  data: json(),
});
export const presets = pgTable(
  "presets",
  {
    id: id(),
    uid: owner(),
    timestamp: integer("timestamp").notNull(),
    data: json(),
  },
  (t) => [index("presets_owner_idx").on(t.uid, t.timestamp)],
);

export const results = pgTable(
  "results",
  {
    id: id(),
    uid: owner(),
    timestamp: integer("timestamp").notNull(),
    mode: text("mode").notNull(),
    mode2: text("mode2").notNull(),
    language: text("language").notNull(),
    wpm: doublePrecision("wpm").notNull(),
    acc: doublePrecision("acc").notNull(),
    client: text("client").$type<"web">().notNull().default("web"),
    submissionHash: text("submission_hash"),
    data: json(),
  },
  (t) => [
    index("results_client_time_idx").on(t.uid, t.client, t.timestamp, t.id),
    check("results_client", sql`${t.client} = 'web'`),
    uniqueIndex("results_submission_idx").on(t.uid, t.submissionHash),
  ],
);
export const blocklist = pgTable(
  "blocklist",
  {
    kind: text("kind").notNull(),
    hash: text("hash").notNull(),
    timestamp: integer("timestamp").notNull(),
  },
  (t) => [primaryKey({ columns: [t.kind, t.hash] })],
);
export const adminUids = pgTable("admin_uids", {
  uid: text("uid").primaryKey(),
});
export const configuration = pgTable("configuration", {
  id: text("id").primaryKey(),
  version: integer("version").notNull().default(0),
  data: json(),
});
export const psas = pgTable("psas", { id: id(), data: json() });
export const publicStats = pgTable("public_stats", {
  id: text("id").primaryKey(),
  testsCompleted: integer("tests_completed").notNull().default(0),
  testsStarted: integer("tests_started").notNull().default(0),
  timeTyping: doublePrecision("time_typing").notNull().default(0),
});
export const speedHistograms = pgTable(
  "speed_histograms",
  {
    board: text("board").notNull(),
    bucket: text("bucket").notNull(),
    count: integer("count").notNull(),
  },
  (t) => [primaryKey({ columns: [t.board, t.bucket] })],
);
export const quoteSubmissions = pgTable(
  "quote_submissions",
  {
    id: id(),
    language: text("language").notNull(),
    submittedBy: text("submitted_by").notNull(),
    timestamp: integer("timestamp").notNull(),
    approved: boolean("approved").notNull().default(false),
    data: json(),
  },
  (t) => [
    index("quote_submissions_review_idx").on(
      t.approved,
      t.language,
      t.timestamp,
    ),
  ],
);
export const quoteRatings = pgTable(
  "quote_ratings",
  {
    id: text("id").notNull(),
    language: text("language").notNull(),
    quoteId: integer("quote_id").notNull(),
    ratings: integer("ratings").notNull().default(0),
    totalRating: doublePrecision("total_rating").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.language, t.quoteId] })],
);
export const userQuoteRatings = pgTable(
  "user_quote_ratings",
  {
    uid: owner(),
    language: text("language").notNull(),
    quoteId: integer("quote_id").notNull(),
    rating: doublePrecision("rating").notNull(),
  },
  (t) => [primaryKey({ columns: [t.uid, t.language, t.quoteId] })],
);
export const reports = pgTable(
  "reports",
  {
    id: id(),
    reportId: text("report_id").notNull().unique(),
    uid: text("uid").notNull(),
    contentId: text("content_id").notNull(),
    type: text("type").notNull(),
    timestamp: integer("timestamp").notNull(),
    data: json(),
  },
  (t) => [
    index("reports_content_idx").on(t.contentId),
    uniqueIndex("reports_reporter_idx").on(t.contentId, t.uid),
  ],
);
export const logs = pgTable(
  "audit_logs",
  {
    id: id(),
    uid: text("uid").notNull(),
    event: text("event").notNull(),
    timestamp: integer("timestamp").notNull(),
    important: boolean("important").notNull().default(false),
    data: json(),
  },
  (t) => [
    index("audit_logs_owner_idx").on(t.uid, t.timestamp),
    index("audit_logs_retention_idx").on(t.important, t.timestamp),
    index("audit_logs_event_idx").on(t.event, t.timestamp),
  ],
);

export const leaderboardBests = pgTable(
  "leaderboard_bests",
  {
    uid: owner(),
    board: text("board").notNull(),
    wpm: doublePrecision("wpm").notNull(),
    acc: doublePrecision("acc").notNull(),
    timestamp: integer("timestamp").notNull(),
    data: json(),
  },
  (t) => [
    primaryKey({ columns: [t.board, t.uid] }),
    index("leaderboard_bests_score_idx").on(t.board, t.wpm, t.acc, t.timestamp),
    index("leaderboard_bests_owner_idx").on(t.uid),
  ],
);
export const leaderboardGenerations = pgTable("leaderboard_generations", {
  board: text("board").primaryKey(),
  generation: text("generation").notNull(),
  updatedAt: integer("updated_at").notNull(),
  /** Published snapshot size; nullable for manually seeded snapshots. */
  entries: integer("entries"),
});
export const leaderboardSnapshots = pgTable(
  "leaderboard_snapshots",
  {
    generation: text("generation").notNull(),
    board: text("board").notNull(),
    uid: owner(),
    rank: integer("rank").notNull(),
    data: json(),
  },
  (t) => [
    primaryKey({ columns: [t.generation, t.board, t.uid] }),
    uniqueIndex("leaderboard_snapshots_rank_idx").on(
      t.generation,
      t.board,
      t.rank,
    ),
    index("leaderboard_snapshots_owner_idx").on(t.uid),
  ],
);
export const dailyEntries = pgTable(
  "daily_entries",
  {
    board: text("board").notNull(),
    period: integer("period").notNull(),
    uid: owner(),
    score: integer("score").notNull(),
    expiresAt: integer("expires_at").notNull(),
    data: json(),
  },
  (t) => [
    primaryKey({ columns: [t.board, t.period, t.uid] }),
    index("daily_entries_rank_idx").on(t.board, t.period, t.score, t.uid),
    index("daily_entries_summary_idx").on(
      t.board,
      t.period,
      sql`((${t.data}->>'wpm')::double precision)`,
    ),
    index("daily_entries_expiry_idx").on(t.expiresAt),
    index("daily_entries_owner_idx").on(t.uid),
  ],
);
export const weeklyEntries = pgTable(
  "weekly_entries",
  {
    period: integer("period").notNull(),
    uid: owner(),
    client: text("client").$type<"web">().notNull().default("web"),
    xp: integer("xp").notNull(),
    timeTypedSeconds: doublePrecision("time_typed_seconds").notNull(),
    expiresAt: integer("expires_at").notNull(),
    data: json(),
  },
  (t) => [
    primaryKey({ columns: [t.client, t.period, t.uid] }),
    index("weekly_entries_rank_idx").on(t.client, t.period, t.xp, t.uid),
    index("weekly_entries_expiry_idx").on(t.expiresAt),
    index("weekly_entries_owner_idx").on(t.uid),
  ],
);
export const userActivity = pgTable(
  "user_activity",
  {
    uid: owner(),
    client: text("client").$type<"web">().notNull().default("web"),
    day: integer("day").notNull(),
    count: integer("count").notNull(),
  },
  (t) => [primaryKey({ columns: [t.uid, t.client, t.day] })],
);
export const mutationGuards = pgTable(
  "mutation_guards",
  { id: id(), valid: integer("valid").notNull() },
  (t) => [check("mutation_version", sql`${t.valid} = 1`)],
);

export const writeReceipts = pgTable(
  "write_receipts",
  {
    id: id(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("write_receipts_created_idx").on(t.createdAt)],
);
