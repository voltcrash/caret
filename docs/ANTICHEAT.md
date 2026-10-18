# Result validation and anticheat

The Worker includes baseline validation in both `MODE=dev` and `MODE=production`.
Valid results can save without an anticheat bypass. All users receive score and
telemetry checks; verification/leaderboard opt-out exempts only the bot heuristic.

## Enforced relationships

- Finite, nonnegative numbers; safe integer character/restart counts.
- WPM = correct whole-word characters × 12 / duration; raw WPM = typed
  characters × 12 / duration. Score/consistency rounding tolerance: 0.011.
- Existing speed caps: 350 WPM/raw WPM, or 420 for 10-word tests. AFK time
  cannot exceed duration. Completed timed tests cannot end over 0.25 seconds
  early; bailouts and infinite tests have no fixed-time minimum.
- Restart count matches abandoned-test records; their durations sum to the
  reported abandoned time. On a first save, abandoned time grants no credit.
- Chart arrays align, contain valid numbers and fit the duration. Their
  consistency scores match the browser calculation. `toolong` requires a
  test longer than 122 seconds.
- Keyboard gaps number one fewer than holds. Nonempty, completed, non-zen
  timelines span the test within 100 ms. Key consistency uses the browser's
  exclusion of the last gap. Both key sentinels must appear together and only
  after 122 seconds.
- Server timestamps bound result duration plus credited abandoned time against
  the previous save; first saves use server account creation time. The existing
  one-second allowance applies. Accounts without creation time fall
  back to the epoch. Database read failures fail closed.

Accuracy cannot be inferred from final character counts: corrected mistakes
still reduce accuracy. Keyboard counts need not equal characters because IME,
mobile input and automatic text can insert characters without key events.
Pre-start holds, unobserved releases and empty keyboard telemetry are supported.
Browsers may [coarsen clocks](https://www.w3.org/TR/hr-time-3/); quantization alone
is not treated as bot evidence.

## Narrow bot signature

The gate applies to time tests above `anticheat.botCheckMinWpm` (default 130)
and shorter than 122 seconds, for unverified users participating in
leaderboards. Missing key arrays return 464. Otherwise, at least 100 interior
holds **and** 100 interior gaps must each be positive and fixed within 0.01 ms
to return 465. Endpoints, sparse composition telemetry, zero placeholders and
variation in either channel avoid this signature.

`users.autoBan.enabled` defaults false. Keep it disabled while reviewing real
typing samples and rejection logs. If enabled, rejected bot requests create
rolling strikes; exceeding `maxCount` within `maxHours` bans the account. These
are request strikes, not deduplicated test identities. Audits/strikes commit
atomically despite rejection; rejected submissions grant no result, PB, XP,
typing-time or leaderboard credit. Concurrency retries cannot duplicate those
writes or the ban notification.

## Replayed key timelines

`anticheat.replayCheck` (enabled, 50 fingerprints) rejects a result whose
keyboard timeline repeats one of the user's recent ones. The fingerprint hashes
gaps and holds rounded to whole milliseconds, so resubmitting a recording with
a new timestamp, mode or flags, or with sub-millisecond noise, still matches.
The client hash cannot catch this because a replay can change any field it
covers. Timelines under 50 keys, with fewer than three distinct gaps, or with
long-test sentinels are not fingerprinted: they can repeat by chance on
coarsened clocks. Repeats return 466 with an `anticheat_rejected` audit
(`replayed-key-timing`) and no strike. Fingerprints are per user and are omitted
from user responses. Exact duplicate submissions are also rejected by the
database's per-user submission-hash constraint.

## Review signals (log only)

`anticheat.review` (enabled, results at or above 100 WPM) describes the
interior gaps and holds of every saved result with the shared timing statistics
in `@oxytype/util/timing-stats`, the same code as the event log viewer. Signals
name properties that generators commonly have and human samples rarely show:

| Signal | Raised when |
| --- | --- |
| `uniform-gaps` / `uniform-holds` | Pause-filtered excess kurtosis ≤ -1 (bounded random ranges sit near -1.2) |
| `low-gap-variation` | Pause-filtered gap coefficient of variation < 0.1 |
| `low-hold-variation` | Hold coefficient of variation < 0.08 |
| `memoryless-timing` | ≥ 200 gaps, and gap autocorrelation plus hold/gap lag-0 and lag-1 correlations all within 1.5σ of zero |
| `small-value-pool` | Distinct values ≤ 5% of samples and not on a clock grid of 2 ms or coarser |

These thresholds are **uncalibrated placeholders**, chosen against a seeded hand
model and synthetic generators, not a labelled human corpus. Signals never
reject, strike or ban. A flagged result saves normally and writes an important
`anticheat_flagged` audit with the result id, signal names and rounded features
(no raw timings). Holds-based signals need at least 100 nonzero holds; IME,
mobile, short and long-test telemetry is skipped.

After `review.suspiciousAfterFlags` flags (default 5) within
`review.suspiciousWindowHours` (default 168), the user's existing `suspicious`
flag is set and audited as `anticheat_marked_suspicious`. It only logs later
short results as `suspicious_user_result` for review; it does not limit the
account. `0` disables escalation; admins clear the flag with
`POST /admin/clearSuspicious`.

## Timing samples

Raw key timings are behavioural data, so capture is off by default.
`anticheat.samples.captureFlagged` stores the gaps/holds of flagged results;
`randomRate` (0-1) stores a random baseline of reviewed results. Both write
non-important `anticheat_sample` audits, which the hourly task deletes after 30
days and account deletion removes. Enable capture for a bounded review period.

## Admin review and calibration

With `admin.endpointsEnabled`, admins can read:

- `GET /admin/anticheat/summary?hours=24`: rejections by reason, flags by
  signal (with distinct users), and the sample count.
- `GET /admin/anticheat/audits?event=anticheat_flagged&limit=50`: audits of
  one event (`anticheat_rejected`, `anticheat_flagged`, `anticheat_sample`),
  newest first; page with `before=<timestamp>` and filter with `uid`.

The calibration runner exercises the fixed-timing signature, replay fingerprint
and every review signal using the production detector functions. From the root:

```sh
vp run --filter @oxytype/backend anticheat:calibrate
```

The default inputs are the eight scripted web recordings and the seeded bot/model fixtures in
`packages/typing-core/__fixtures__/anticheat`. None is a labelled human sample.
The web recordings are transport evidence, labelled `recorded-web`. Modelled hands are labelled `model`, including the first upload
in the replay fixture. These labels are excluded from human false-positive and
bot false-negative rates.

To calibrate on reviewed human web samples and known bots:

```sh
vp run --filter @oxytype/backend anticheat:calibrate \
  human-web=/path/to/reviewed-web \
  bot=/path/to/known-bots
```

Each path is a JSON file or a directory of JSON files. Use **one user's history
per file, oldest first**; split admin exports by user and reverse the API's
newest-first ordering. A file accepts an admin audit response, audit rows with
arrays in `message`, an array of `{ keySpacing, keyDuration, client? }`, a
`record-fixtures.ts` fixture (`completedEvent`/`result`), or
`{ label, client, samples }`. Without a client, web semantics apply. Per-sample `label` overrides the file label, so a legitimate
original upload and its bot resubmissions can share one replay history. Invalid
samples and long-test sentinels are skipped.

Reports contain per-label sample counts, applicable/flagged counts and rates
for all eight detectors, aggregate false-positive/false-negative rates, and
review-feature percentiles. Labels beginning `human` or `bot` supply ground
truth; other labels are descriptive only. Rates range from 0 to 1. A missing
applicable denominator produces **null, never a measured zero**. `any` counts
all labelled samples, including those too short for a detector. Replay compares
only within each file and retains the default 50 accepted fingerprints; rejected
replays do not refresh history. This evaluates timing evidence, not the full
submission gates (WPM, mode, verification, opt-out, sparse compositions or server
configuration). Per-detector miss rates include bots designed for other detectors.

Regenerate deterministic bots with the plan helpers shared by the web recorder:

```sh
vp exec node packages/typing-core/scripts/record-bot-fixtures.ts
vp fmt packages/typing-core/__fixtures__/anticheat
```

The fixtures cover fixed web timings, sub-ms and ±1 ms jitter, bounded random
ranges, scripted web delays, small value pools, independent Gaussian/lognormal
draws, and exact/noisy replays. The default report currently shows:

| Set | Samples | Any detector flags |
| --- | ---: | ---: |
| Scripted web recordings | 8 | 0 (only 5 qualify for replay; none for review) |
| Automated PTY recording | 1 | 0 (too short for all detectors) |
| Synthetic bots | 11 | 10 (9.09% aggregate false negatives) |
| Modelled hands | 6 | 1 (memoryless-timing; not a human false positive) |

The noisy replay escapes: changing timings by less than a millisecond can still
move individual values across rounding boundaries and change the fingerprint.
The exact replay is caught. These tiny synthetic sets establish reproducibility
and expose blind spots; they do not justify threshold changes. Human web
false-positive rates remain **unmeasured (null)**. Collect and review real samples
before tightening thresholds or enabling enforcement.

## Limits and monitoring

This is consistency validation, a deliberately narrow bot heuristic, per-user
replay detection and log-only review. Client telemetry remains forgeable;
coherent fabricated scores, freshly generated human-like timing, recordings
from another account and recordings whose perturbations cross whole-ms rounding
boundaries can
evade it. The public, unkeyed payload hash detects inconsistencies, not
authenticity. No server-issued test challenge, source-text replay or
classifier calibrated on a labelled human corpus is provided. High speed alone
is not evidence of cheating.

Production-mode D1 tests cover saves/rejections, exemptions, concurrency, expired
strikes, absence of progression on rejection, replay rejection, review audits,
sample capture, escalation and admin audit queries. Browser-reducer fixtures cover
normal typing, coarsened clocks, IME, pre-start keys, bailouts and zen, and
modelled human timing produces no review signal. This is synthetic evidence;
review real user samples before tightening rules or acting on signals.

Follow [staging setup](STAGING_SETUP.md) to configure credentials and repeat signup,
save, refresh and sign-out/sign-in checks. Monitor `anticheat_rejected` audits
by reason, `anticheat_flagged` audits by signal and important-audit growth.

Apply pending D1 migrations before deploying.
Watch the summary endpoint, enable `samples.randomRate` briefly (for example
0.05) to build a human baseline, review flagged results, then run the calibration
command before changing thresholds or considering enforcement.

```sh
cd backend
vp test run __tests__/d1/anticheat.spec.ts
cd ../frontend
vp test run __tests__/test/events/anticheat.spec.ts
cd ..
vp lint --type-aware --type-check --format agent
vp run build
```
