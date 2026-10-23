# Engine contract v1

Binding version 1; behavior version 1; stored web event-log version 1. These are
independent. Reject a binding version mismatch before creating a session. Existing
logs keep version 1 and their interpretation. This migration changes no score rule.

## Units and representation

`Text = u16[]`: JavaScript UTF-16 code units, including isolated surrogates. All
target words, committed text, input snapshots and composition text cross the
neutral boundary as Text. Rust stores these losslessly; never use `chars().count()`
for `charIndex`, input length, slicing, or scoring. Browser glue converts Text with
bounded `String.fromCharCode` chunks and `charCodeAt`. UTF-8 conversion is allowed
only for host display, with explicit replacement of isolated surrogates. Terminal
graphemes/cells are display units; retain UTF-16 offsets in results.

`now`: finite monotonic milliseconds, host-captured. Recorder rounds to two decimal
places using existing JS roundTo2 semantics. Wall-clock `date` is separate explicit
Unix milliseconds, supplied by host, never used for input intervals. Native host
uses Instant for now. Equal timestamps preserve capture order internally; stored
logs preserve the legacy stable tie ordering: keyup, keydown, input, composition,
timer (input before composition when tied, matching recorder group merge).

Optional properties are omitted, never replaced by false/null. Legacy JSON converts
nonfinite derived numbers to null. Published rounded scores require exact equality;
unrounded float fields compare exact IEEE-754 values unless a documented field
tolerance is established by cross-platform evidence. No blanket epsilon.

## Ownership and commands

One independent session owns word index, input history, rule config, recorder,
timer, generator, pace and completion. No global state, implicit clock, I/O, DOM,
callback that overrides progression, or platform RNG. Hosts own scheduling,
observations, assets, rendering, storage, transport and account fields.

Commands are synchronous after module/content preparation. Initial proof commands:

- `insert {data: Text, now, date, correctShiftUsed?, automatic?, isCompositionEnding?}`
- `delete {kind: deleteContentBackward|deleteWordBackward, now, date}`
- `start`, `advance`, `finish {reason?}`, `end`, `abandon` with now/date
- `observe {type: keydown|keyup|composition|timer, data, now}`
- `reset`: retain prepared content, clear recorder/timer/input/finish state

Full port adds config projection/update, browser observations, content requests,
generation/repeat, pace/weak-spot operations, result derivation and historical replay.
Typed Rust declarations must define these before use; proof coverage does not imply
the full surface is ready. Full snapshots/event logs are explicit reads; hot-path
updates contain ordered new events, changed words, cursor/current input, status,
tick/finish notifications. No growing full log copied per key.

## Lifecycle and failures

Created → ready → active → ended; reset returns ready. Finish emits once. End and
abandon stop silently; abandon measures incomplete engaged time. After ended,
typing/ticks cannot restart; release observations can finalize held keys until
disposal. Disposal releases instance allocation; repeated disposal is harmless;
all other stale-handle commands fail structurally. A reset increments a generation
token. Async assets and queued automatic indentation carry that token; late replies
cannot affect another generation. Initialization failure leaves input disabled and
allows retry with a new instance. Commands validate before mutation.

Content loading is host-owned. Rust requests a typed token; host supplies validated
content with the matching token/generation. While awaiting content, block new typing
as the current web does; do not queue unbounded text. Reset cancels pending requests.
Prepare content ahead where possible. Infinite generation stays bounded per request.

## Browser observations that affect existing behavior

Beforeinput observes actual textarea/sentinel deletion range, word visibility,
overflow measurements, modifiers/Shift correctness, composition state and captured
time. Rust decides acceptance/progression. DOM absence must not silently become
freedom to backtrack beyond the old visible window. Firefox can delete sentinel
plus residue; preserve clearedNextWord. Host callbacks do not supply word index.

Known headless/web differences requiring recorded web cases before input cutover:

- Web checks failure/completion after the last multi-input unit and outside active
  composition; headless session checks every unit. Rust now checks at the final
  committed unit, proved by the actual-browser master multi-input regression.
- Web schedules automatic tabs on a later task; headless session inserts recursively.
- Web records DOM-based limits/visible words; headless session has no observations.
- Web normalizes prior to ellipsis expansion; headless path checks blocking first.

Do not assume passing TestSession fixtures proves these paths. Existing frontend
handler tests/browser characterization remain authoritative; add cases before 1.4.

## Configuration and random source

Legacy settings migration, labels, themes, display preferences remain TS and SSR
safe. Engine config is a normalized projection, never the entire web preferences
object. Preserve current effective live rule reads; capture config at each command.
Generation reads config at its existing generation boundaries. Do not freeze a
currently live setting silently. Rust defaults/capabilities generate checked host
metadata; transport Zod schemas remain authoritative and mechanically checked.

Fixtures supply the exact floating-point random stream in [0,1); exhaustion is an
error, not reseeding. Production uses a specified seeded algorithm, host-provided
seed, stable draw order; seed algorithm/behavior version accompanies native history.
Legacy generator snapshots require their existing Mulberry32 stream, not matching
only distributions. Host asset loaders supply English punctuation/replacement data;
Rust decides transform order and random consumption.

## Results, replay and host transport

Rust derives shared scores/histories/eligibility and replay from versioned logs.
Physical observations are optional capabilities. No keyup capability means durations
unavailable, never invented zeros/releases. Browser synthetic releases retain the
existing estimated marker. Native summaries distinguish unavailable from measured
zero. Terminal stores no account credentials and submits no web results.

Web host adds uid/tags/challenge/network metadata and runs the existing object-hash
helper after those fields. Preserve schemas, omitted fields and backend validation.
Hashing is transport, not a Rust JSON hash. Full historical fixtures and anticheat
rejection tests must pass before removing TS result/replay implementations.

## Differential evidence

Immutable original fixtures: packages/typing-fixtures/reference, copied byte-for-byte
from the starting commit; original hashes in reference-manifest.json. New command
fixtures: commands/*.json, with frozen TypeScript frames in oracle/*.json.
Compare every command's state and events, then final derived values. A harness
self-test must reject a deliberately altered word index. New captures refuse to
overwrite files. Existing snapshots are never updated by the harness.

## Observed web completion

`view {deferFinish:true}` enables a finish-request/acknowledgement handshake. Rust decides completion and returns `finish` in the update; hosts disable input and stop scheduling, perform the same platform navigation/hooks as before, then send `acknowledgeFinish {now,date}`. The end event uses that explicit observation, preserving the website's later completion clock without a hidden Rust clock. New typing/ticks cannot change the decision while awaiting acknowledgement. Reset/end cancel it; stale/duplicate acknowledgement is an error. Native callers can keep immediate completion.

## Retained learning and pace

An app owns `Content` across test replacements. Call `recycle_session` before preparing a replacement to consume the old session and retain only weak-spot learning and remembered pace WPM. Its log, input, pending content and completion state are dropped; the consumed handle rejects subsequent calls. Independent content owners retain independent learning. Explicit disposal drops an owner entirely. Pace commands are synchronous; Rust uses bare UTF-16 word lengths for caret stepping and full targets for mistake correction. Hosts supply speed selection from account/PB data and schedule/render steps.

Content preparation advances an owner-local generation. Recycling takes the maximum of the owner's generation and the consumed session's reset generation; the next preparation advances it. Old content/automatic tokens cannot match a replacement session. Owner instances route their own replies. Explicit repeated preparation retains generated words and quote identity; quote repetition does not advance the selection queue.

### Structured failures

Native operations return EngineError with a stable code, display message and ordered Recovery actions. Wasm carries this DTO as JSON in its private generated exception message; the public browser facade decodes EngineFailure. Consumers inspect code/actions, never parse human wording. Empty messages are intentional for recovery paths that supply a notice. Corrected content preparation may retry after validation/recovery failures. Disposal and ABI mismatch are explicit failures; no session becomes usable after failed initialization.
