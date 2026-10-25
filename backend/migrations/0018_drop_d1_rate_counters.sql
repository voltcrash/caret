-- Rate limits moved to Workers rate limiting (0017's release). Deploy that
-- Worker first: older Workers write these tables on every request.
DROP TABLE IF EXISTS `rate_counters`;--> statement-breakpoint
DROP TABLE IF EXISTS `auth_rate_limits`;
