// Column-builder return types must retain Drizzle's inferred column metadata.
import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
  primaryKey,
  check,
} from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey();
const json = (name = "data") =>
  text(name, { mode: "json" }).$type<Record<string, unknown>>().notNull();
const date = (name: string) =>
  integer(name, { mode: "timestamp_ms" }).notNull();

// Better Auth 1.7.7 core schema + this application's additional fields/model names.
export const authUsers = sqliteTable("auth_users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  disabled: integer("disabled", { mode: "boolean" }).notNull().default(false),
  createdAt: date("created_at"),
  updatedAt: date("updated_at"),
});
export const authSessions = sqliteTable(
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
export const authAccounts = sqliteTable(
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
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
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
export const authVerifications = sqliteTable(
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
export const authDeviceCodes = sqliteTable(
  "auth_device_codes",
  {
    id: id(),
    deviceCode: text("device_code").notNull().unique(),
    userCode: text("user_code").notNull().unique(),
    userId: text("user_id").references(() => authUsers.id, {
      onDelete: "cascade",
    }),
    expiresAt: date("expires_at"),
    status: text("status").notNull(),
    lastPolledAt: integer("last_polled_at", { mode: "timestamp_ms" }),
    pollingInterval: integer("polling_interval"),
    clientId: text("client_id"),
    scope: text("scope"),
  },
  (t) => [index("auth_device_codes_expiry_idx").on(t.expiresAt)],
);
export const authRateLimits = sqliteTable("auth_rate_limits", {
  id: id(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: integer("last_request").notNull(),
});

// Auth can exist before application registration; do not require an app row for sessions.
export const users = sqliteTable("users", {
  uid: text("uid").primaryKey(),
  id: text("id").notNull().unique(),
  name: text("name").notNull(),
  nameKey: text("name_key").notNull().unique(),
  email: text("email").notNull(),
  addedAt: integer("added_at").notNull(),
  xp: integer("xp").notNull().default(0),
  timeTyping: real("time_typing").notNull().default(0),
  completedTests: integer("completed_tests").notNull().default(0),
  startedTests: integer("started_tests").notNull().default(0),
  banned: integer("banned", { mode: "boolean" }).notNull().default(false),
  lbOptOut: integer("lb_opt_out", { mode: "boolean" }).notNull().default(false),
  needsToChangeName: integer("needs_to_change_name", { mode: "boolean" })
    .notNull()
    .default(false),
  version: integer("version").notNull().default(0),
  data: json(),
});
const owner = () =>
  text("uid")
    .notNull()
    .references(() => users.uid, { onDelete: "cascade" });
export const clientProfiles = sqliteTable(
  "client_profiles",
  {
    uid: owner(),
    client: text("client").$type<"web" | "tui">().notNull(),
    timeTyping: real("time_typing").notNull().default(0),
    data: json(),
  },
  (t) => [
    primaryKey({ columns: [t.uid, t.client] }),
    check("client_profiles_client", sql`${t.client} IN ('web','tui')`),
  ],
);
export const configs = sqliteTable("configs", {
  uid: owner().primaryKey(),
  id: text("id").notNull(),
  data: json(),
});
export const presets = sqliteTable(
  "presets",
  {
    id: id(),
    uid: owner(),
    timestamp: integer("timestamp").notNull(),
    data: json(),
  },
  (t) => [index("presets_owner_idx").on(t.uid, t.timestamp)],
);
export const apeKeys = sqliteTable(
  "ape_keys",
  {
    id: id(),
    uid: owner(),
    name: text("name").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull(),
    hash: text("hash").notNull(),
    createdOn: integer("created_on").notNull(),
    modifiedOn: integer("modified_on").notNull(),
    lastUsedOn: integer("last_used_on").notNull(),
    useCount: integer("use_count").notNull().default(0),
  },
  (t) => [index("ape_keys_owner_idx").on(t.uid)],
);
export const results = sqliteTable(
  "results",
  {
    id: id(),
    uid: owner(),
    timestamp: integer("timestamp").notNull(),
    mode: text("mode").notNull(),
    mode2: text("mode2").notNull(),
    language: text("language").notNull(),
    wpm: real("wpm").notNull(),
    acc: real("acc").notNull(),
    client: text("client").$type<"web" | "tui">().notNull().default("web"),
    submissionHash: text("submission_hash"),
    data: json(),
  },
  (t) => [
    index("results_client_time_idx").on(t.uid, t.client, t.timestamp, t.id),
    check("results_client", sql`${t.client} IN ('web','tui')`),
    index("results_owner_time_idx").on(t.uid, t.timestamp, t.id),
    index("results_mode_idx").on(t.uid, t.mode, t.mode2, t.language),
    uniqueIndex("results_submission_idx").on(t.uid, t.submissionHash),
  ],
);
export const blocklist = sqliteTable(
  "blocklist",
  {
    kind: text("kind").notNull(),
    hash: text("hash").notNull(),
    timestamp: integer("timestamp").notNull(),
  },
  (t) => [primaryKey({ columns: [t.kind, t.hash] })],
);
export const adminUids = sqliteTable("admin_uids", {
  uid: text("uid").primaryKey(),
});
export const configuration = sqliteTable("configuration", {
  id: text("id").primaryKey(),
  version: integer("version").notNull().default(0),
  data: json(),
});
export const psas = sqliteTable("psas", { id: id(), data: json() });
export const publicStats = sqliteTable("public_stats", {
  id: text("id").primaryKey(),
  testsCompleted: integer("tests_completed").notNull().default(0),
  testsStarted: integer("tests_started").notNull().default(0),
  timeTyping: real("time_typing").notNull().default(0),
});
export const speedHistograms = sqliteTable(
  "speed_histograms",
  {
    board: text("board").notNull(),
    bucket: text("bucket").notNull(),
    count: integer("count").notNull(),
  },
  (t) => [primaryKey({ columns: [t.board, t.bucket] })],
);
export const quoteSubmissions = sqliteTable(
  "quote_submissions",
  {
    id: id(),
    language: text("language").notNull(),
    submittedBy: text("submitted_by").notNull(),
    timestamp: integer("timestamp").notNull(),
    approved: integer("approved", { mode: "boolean" }).notNull().default(false),
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
export const quoteRatings = sqliteTable(
  "quote_ratings",
  {
    id: text("id").notNull(),
    language: text("language").notNull(),
    quoteId: integer("quote_id").notNull(),
    ratings: integer("ratings").notNull().default(0),
    totalRating: real("total_rating").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.language, t.quoteId] })],
);
export const userQuoteRatings = sqliteTable(
  "user_quote_ratings",
  {
    uid: owner(),
    language: text("language").notNull(),
    quoteId: integer("quote_id").notNull(),
    rating: real("rating").notNull(),
  },
  (t) => [primaryKey({ columns: [t.uid, t.language, t.quoteId] })],
);
export const reports = sqliteTable(
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
export const logs = sqliteTable(
  "audit_logs",
  {
    id: id(),
    uid: text("uid").notNull(),
    event: text("event").notNull(),
    timestamp: integer("timestamp").notNull(),
    important: integer("important", { mode: "boolean" })
      .notNull()
      .default(false),
    data: json(),
  },
  (t) => [
    index("audit_logs_owner_idx").on(t.uid, t.timestamp),
    index("audit_logs_retention_idx").on(t.important, t.timestamp),
    index("audit_logs_event_idx").on(t.event, t.timestamp),
  ],
);

export const leaderboardBests = sqliteTable(
  "leaderboard_bests",
  {
    uid: owner(),
    board: text("board").notNull(),
    wpm: real("wpm").notNull(),
    acc: real("acc").notNull(),
    timestamp: integer("timestamp").notNull(),
    data: json(),
  },
  (t) => [
    primaryKey({ columns: [t.board, t.uid] }),
    index("leaderboard_bests_score_idx").on(t.board, t.wpm, t.acc, t.timestamp),
  ],
);
export const leaderboardGenerations = sqliteTable("leaderboard_generations", {
  board: text("board").primaryKey(),
  generation: text("generation").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
export const leaderboardSnapshots = sqliteTable(
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
export const dailyEntries = sqliteTable(
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
    index("daily_entries_expiry_idx").on(t.expiresAt),
    index("daily_entries_owner_idx").on(t.uid),
  ],
);
export const weeklyEntries = sqliteTable(
  "weekly_entries",
  {
    period: integer("period").notNull(),
    uid: owner(),
    client: text("client").$type<"web" | "tui">().notNull().default("web"),
    xp: integer("xp").notNull(),
    timeTypedSeconds: real("time_typed_seconds").notNull(),
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
export const userActivity = sqliteTable(
  "user_activity",
  {
    uid: owner(),
    client: text("client").$type<"web" | "tui">().notNull().default("web"),
    day: integer("day").notNull(),
    count: integer("count").notNull(),
  },
  (t) => [primaryKey({ columns: [t.uid, t.client, t.day] })],
);
export const inbox = sqliteTable(
  "inbox",
  {
    id: text("id").notNull(),
    uid: owner(),
    timestamp: integer("timestamp").notNull(),
    read: integer("read", { mode: "boolean" }).notNull().default(false),
    deleted: integer("deleted", { mode: "boolean" }).notNull().default(false),
    data: json(),
  },
  (t) => [
    primaryKey({ columns: [t.uid, t.id] }),
    index("inbox_owner_idx").on(t.uid, t.timestamp),
  ],
);
export const rewardGrants = sqliteTable(
  "reward_grants",
  {
    id: id(),
    uid: owner(),
    origin: text("origin").notNull(),
    claimed: integer("claimed", { mode: "boolean" }).notNull().default(false),
    data: json(),
  },
  (t) => [
    uniqueIndex("reward_grants_origin_idx").on(t.origin, t.uid),
    index("reward_grants_owner_idx").on(t.uid),
  ],
);
export const rateCounters = sqliteTable(
  "rate_counters",
  {
    key: text("key").primaryKey(),
    points: integer("points").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("rate_counters_expiry_idx").on(t.expiresAt)],
);
export const scheduledJobs = sqliteTable(
  "scheduled_jobs",
  {
    id: id(),
    type: text("type").notNull(),
    dueAt: integer("due_at").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    leaseUntil: integer("lease_until").notNull().default(0),
    data: json(),
  },
  (t) => [
    index("scheduled_jobs_due_idx").on(t.status, t.dueAt),
    index("scheduled_jobs_lease_idx").on(t.status, t.leaseUntil),
  ],
);
export const outbox = sqliteTable(
  "outbox",
  {
    id: id(),
    type: text("type").notNull(),
    uid: text("uid"),
    createdAt: integer("created_at").notNull(),
    sentAt: integer("sent_at"),
    completedAt: integer("completed_at"),
    data: json(),
  },
  (t) => [
    index("outbox_pending_idx").on(t.sentAt, t.createdAt),
    index("outbox_owner_idx").on(t.uid),
  ],
);
export const mutationGuards = sqliteTable(
  "mutation_guards",
  { id: id(), valid: integer("valid").notNull() },
  (t) => [check("mutation_version", sql`${t.valid} = 1`)],
);
