-- One-time fresh install, before publishing the Worker. No updates or deletes.
-- NULL violates configuration.data's NOT NULL constraint if any application
-- table already contains data. A rerun therefore refuses an initialized target.
INSERT INTO configuration (id, data)
SELECT 'main', CASE WHEN
  EXISTS (SELECT 1 FROM configuration)
  OR EXISTS (SELECT 1 FROM admin_uids)
  OR EXISTS (SELECT 1 FROM auth_accounts)
  OR EXISTS (SELECT 1 FROM auth_rate_limits)
  OR EXISTS (SELECT 1 FROM auth_sessions)
  OR EXISTS (SELECT 1 FROM auth_users)
  OR EXISTS (SELECT 1 FROM auth_verifications)
  OR EXISTS (SELECT 1 FROM blocklist)
  OR EXISTS (SELECT 1 FROM configs)
  OR EXISTS (SELECT 1 FROM daily_entries)
  OR EXISTS (SELECT 1 FROM leaderboard_bests)
  OR EXISTS (SELECT 1 FROM leaderboard_generations)
  OR EXISTS (SELECT 1 FROM leaderboard_snapshots)
  OR EXISTS (SELECT 1 FROM audit_logs)
  OR EXISTS (SELECT 1 FROM mutation_guards)
  OR EXISTS (SELECT 1 FROM presets)
  OR EXISTS (SELECT 1 FROM psas)
  OR EXISTS (SELECT 1 FROM public_stats)
  OR EXISTS (SELECT 1 FROM quote_ratings)
  OR EXISTS (SELECT 1 FROM quote_submissions)
  OR EXISTS (SELECT 1 FROM rate_counters)
  OR EXISTS (SELECT 1 FROM reports)
  OR EXISTS (SELECT 1 FROM results)
  OR EXISTS (SELECT 1 FROM speed_histograms)
  OR EXISTS (SELECT 1 FROM user_activity)
  OR EXISTS (SELECT 1 FROM user_quote_ratings)
  OR EXISTS (SELECT 1 FROM users)
  OR EXISTS (SELECT 1 FROM weekly_entries)
THEN NULL ELSE json('{
  "users": {
    "signUp": true,
    "profiles": {"enabled": true},
    "autoBan": {"enabled": false}
  },
  "results": {"savingEnabled": true, "objectHashCheckEnabled": true}
}') END;
