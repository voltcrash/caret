DROP TABLE IF EXISTS `ape_keys`;--> statement-breakpoint
UPDATE users SET data = json_remove(data, '$.canManageApeKeys'), version = version + 1
WHERE json_type(data, '$.canManageApeKeys') IS NOT NULL;--> statement-breakpoint
UPDATE configuration SET data = json_remove(data, '$.apeKeys'), version = version + 1
WHERE json_type(data, '$.apeKeys') IS NOT NULL;--> statement-breakpoint
DELETE FROM rate_counters
WHERE key LIKE 'rate:apeKeysGet:%'
  OR key LIKE 'rate:apeKeysGenerate:%'
  OR key LIKE 'rate:defaultApeRateLimit:%'
  OR key LIKE 'rate:resultsGetApe:%'
  OR key LIKE 'rate:resultByIdGetApe:%';
