# Offline local data

Settings use `settings.sqlite3` under the OS config directory. History uses
`history.sqlite3` under the OS local data directory. Paths are resolved with
`directories::ProjectDirs("com", "Oxytype", "Oxytype")`; explicit `--config-dir`
and `--data-dir` overrides support portable installs/testing. No account, tokens,
telemetry or transport. Data remains until the user removes these directories.

SQLite is bundled into the executable. Each database uses `user_version=1`, WAL,
FULL synchronization and a two-second busy timeout. Transactions keep completed
writes atomic; concurrent app instances append distinct result IDs. Settings use
a revision comparison so one instance cannot silently overwrite another's edits.
New Unix directories/files are private (0700/0600); platform ACLs apply elsewhere.
Do not copy only the main file while the app runs: WAL may contain committed data.
Use JSON export or close all instances before copying the entire data directory.

Malformed files and future database/settings versions fail clearly, preserving
the original file. No automatic deletion, repair, reset or score recalculation.
Back up a damaged directory before attempting external recovery. Disk errors
must be reported; the current unsaved result can be retried while the app runs.

Result JSON envelopes independently carry `formatVersion=1`, UUID, timestamp,
effective native config, native mode2, seed, content SHA-256 identity, quote ID,
custom limit, engine behavior/log/build versions, native validity, capabilities
and summary. Content identity fingerprints source assets/custom text without
storing its path or raw text; a hash is not encryption. Replay logging is off by
default because target words and input events can contain private text.

Physical identity, hold durations, spacing, overlap, key consistency and
first/last physical-key timing are unavailable. Those summary fields are null,
including when the terminal reports releases: terminal delivery is not a
measurement of physical switch timing. WPM/accuracy/duration/charts remain the
native engine's values based on actual committed input and monotonic delivery
timestamps. No fabricated releases or wall-clock input intervals.

Stored summaries are authoritative historical values. Export preserves unknown
record versions/fields as JSON; it does not reinterpret them using today's core.
Exports write a synced temporary file and publish without replacing an existing
path. Result UUID retries are idempotent; a collision with different content fails.
Optional replay is offered only when an actual compatible event log was recorded.

Local personal bests compare stored native WPM within the effective config,
native mode2 and content identity. Shared validity and funbox PB metadata decide
eligibility; repeated, failed or otherwise invalid results remain in history.
No score formula or acceptance policy is reimplemented by storage.

Optional replay logs use the native Rust DTO: Text fields retain arrays of UTF-16
units, including partial surrogates where legacy rules produce them. The local
envelope version distinguishes this representation from browser transport JSON.
Core event semantics/log version remain shared; converting stored web records
into local terminal history is outside this release. Never interpret Rust scalar
or byte offsets as JavaScript event indices.
