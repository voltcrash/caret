# Account history payload

The account page waits for one `resultsGet` server-function call before it shows statistics. That call returns at most 1,000 results (`results.maxBatchSize` and the regular-user limit). PostgreSQL drops chart data and key timing statistics before transfer (`backend/src/dal/result.ts`), and the strict response schema drops fields the client does not use, such as `submissionHash`. A 1,000-result sample measures:

| Response | Raw bytes | gzip bytes | Brotli bytes |
| --- | ---: | ---: | ---: |
| `resultsGet`, 1,000 results | 566,107 | 58,420 | 34,921 |

At the 4 Mbit/s cold-mobile profile in [mobile startup](mobile-startup.md), 58 KB of gzip is about 0.12 s of transfer. Transfer size does not justify paginating account history. Seroval's encoding nearly doubles the raw bytes compared with the decoded rows as JSON (295,995 bytes), but compression removes most of that overhead.

## Method

[`result-history-size.spec.ts`](../../frontend/__tests__/start/result-history-size.spec.ts) runs against the built Start Worker in workerd with PGlite. It saves one result through `resultsAdd`, clones it in PostgreSQL into 1,100 results with varied speed, accuracy, consistency, duration, character counts, IDs and submission hashes, then calls `resultsGet` as the browser does. It asserts 1,000 rows and fewer than 62,000 gzip bytes. The raw and Brotli figures come from one run of the same spec with Node's default `zlib` settings. Cloudflare's edge compression levels differ, so treat compressed sizes as approximate. Account IDs are random, so gzip size varies by a few dozen bytes between runs.

This is a sample, not a maximum. Real results can also carry tags, non-default languages, funboxes and other optional fields, which the cloned results omit. Premium accounts, when enabled, may page up to 10,000 results, but the web client requests only one batch.
