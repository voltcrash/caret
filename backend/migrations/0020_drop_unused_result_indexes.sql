-- No production query uses these: history and last-result reads filter by
-- client (results_client_time_idx); ownership cascades use any uid-led index.
-- Every result insert no longer writes two extra index b-trees.
DROP INDEX IF EXISTS `results_owner_time_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `results_mode_idx`;
