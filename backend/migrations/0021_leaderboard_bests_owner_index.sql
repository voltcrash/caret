-- leaderboard_bests is keyed (board, uid): deleting a user (FK cascade) or
-- resetting their personal bests scanned every board's rows.
CREATE INDEX IF NOT EXISTS `leaderboard_bests_owner_idx` ON `leaderboard_bests` (`uid`);
