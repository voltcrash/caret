-- Covers the daily leaderboard page summary (count + min wpm) so it no longer
-- reads and parses every entry's JSON. Expression must match db/ranking.ts.
CREATE INDEX IF NOT EXISTS `daily_entries_summary_idx` ON `daily_entries` (`board`,`period`,`expires_at`,json_extract(`data`,'$.wpm'));
