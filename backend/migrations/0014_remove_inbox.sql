DROP TABLE IF EXISTS `inbox`;--> statement-breakpoint
DROP TABLE IF EXISTS `reward_grants`;--> statement-breakpoint
DROP TABLE IF EXISTS `outbox`;--> statement-breakpoint
DROP TABLE IF EXISTS `scheduled_jobs`;--> statement-breakpoint
UPDATE users SET data = json_remove(data, '$.inbox', '$.inboxUnreadSize'), version = version + 1
WHERE json_type(data, '$.inbox') IS NOT NULL OR json_type(data, '$.inboxUnreadSize') IS NOT NULL;--> statement-breakpoint
UPDATE configuration SET data = json_remove(data, '$.users.inbox', '$.dailyLeaderboards.scheduleRewardsModeRules', '$.dailyLeaderboards.xpRewardBrackets', '$.leaderboards.weeklyXp.xpRewardBrackets'), version = version + 1
WHERE json_type(data, '$.users.inbox') IS NOT NULL
  OR json_type(data, '$.dailyLeaderboards.scheduleRewardsModeRules') IS NOT NULL
  OR json_type(data, '$.dailyLeaderboards.xpRewardBrackets') IS NOT NULL
  OR json_type(data, '$.leaderboards.weeklyXp.xpRewardBrackets') IS NOT NULL;
