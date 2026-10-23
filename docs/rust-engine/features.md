# Feature parity checklist

Rust parity is complete for the shared-rule rows below. Website integration remains a separate Stage 2 gate; browser proof does not claim production cutover. Native tests live in `crates/typing-engine/tests`; built-Wasm cases in `frontend/e2e/engine-{proof,input-contract,lifecycle}.migration.ts`. Immutable references are under `packages/typing-fixtures`.

| Feature | Rust | Native / Wasm / web evidence |
| --- | --- | --- |
| words: finite / zero infinite | Implemented | `generation`, `generated_session`, `content`; original 61 generators |
| time: presets / custom / zero infinite | Implemented | `generation`, `fractional_limits`, `input`; zero/stall/fractional oracles |
| quote: lengths / IDs / repeat / British text | Implemented | `generation`, `learning`, `recovery`, `quote_queue`; IDs/repeat/queue RNG |
| custom: random / repeat / shuffle; pipe sections; word / time / section limits | Implemented | `generation`, `fractional_limits`, `generated_session`; sections/limits/RNG |
| zen: free typing / bailout / trailing idle | Implemented | `input`, `recordings`, `completion`; bailout/idle |
| language: lazy accents / additional accents / noLazyMode | Implemented | `transforms`, `generation`, `live_generation`; normalization oracle |
| punctuation / original punctuation / numbers / numeral scripts | Implemented | `transforms`, `generation`, `live_generation`; exact random draws |
| wordset: random / Zipf / shuffled / previous-two exclusion | Implemented | `generation`, `random`; original generators and explicit random streams |
| funbox sections / polyglot language properties / asynchronous content | Implemented | `content`, `generated_session`, `recovery`; async stale/failure cases |
| normal / expert / master difficulty | Implemented | `input`, `recordings`; command frames and actual-web batch characterization |
| strictSpace / stopOnError letter and word | Implemented | `input`; immutable input-rules and command traces |
| deleteOnError letter / word / hard; stopped-input interaction | Implemented | `input`; four delete-error oracles and stopped input |
| confidence off / on / max; freedomMode; visible-word bound | Implemented | `input`; observed visible bounds and historical commands |
| UTF-16 split commits / partial surrogates / grapheme-independent scores | Implemented | `input`, `analysis`, `transforms`; split halves, exhaustive UTF-16 map |
| IME multi-character / composition quick finish / equivalent spaces | Implemented | `input`, `observations`; IME oracle and browser input-contract |
| typography equivalents / ellipsis / Dutch ligature / opposite Shift | Implemented | `input`; normalization oracle, batch and opposite Shift |
| code automatic tabs / unindent / newline / Firefox deletion | Implemented | `input`; deferred task/generation and Firefox sentinel observations |
| timer drift / catchup / background stalls / simultaneous timestamps | Implemented | `input`, `slow_timer`, `stress`; stalls/ties/delayed completion |
| reset / restart / repeat / abandon / completion once / stale commands | Implemented | `restart`, `content`, `stress`; 128 seeds / 12,800 commands |
| minimum burst / speed / accuracy; flex burst | Implemented | `input`, `live`; minimum rules and 1,387 frozen live prefixes |
| pace correction / remembered speed / weak-spot learning | Implemented | `pace`, `weak_spot`, `learning`; retained learning and pace commands |
| accuracy / WPM / raw / chars / consistency / burst | Implemented | `statistics`, `recordings`, `live`; eight exact historical summaries |
| physical timing / synthetic observations / estimated release markers | Implemented | `observations`; repeat/NoCode/estimated cleanup and optional observations |
| histories / charts / idle / incomplete duration / validity | Implemented | `analysis`, `recordings`, `completion`; exact charts/eligibility/idle |
| historical replay / seek / regression / clearedNextWord | Implemented | `analysis`; historical Unicode and persistent Wasm playback/seek |
| CompletedEvent fields / schemas / submission hash / backend rejection | Implemented | `wire`, `recordings`; Wasm Zod + eight hashes/backend integrity outcomes |
| settings imports / presets / URL overrides / live rules | Stage 2 host gate | `live_generation`, `funboxes`; live rules/policy complete; imports/presets/URL Stage 2 |
| custom text progress / practice missed and slow words | Implemented | `custom_progress`, `analysis`; browser progress/practice cases |
| SSR safety / Cloudflare asset MIME+CSP / stale tabs / rollback | Stage 2 host gate | Proof MIME/CSP/client boundary pass; complete deployed website lifecycle Stage 2 |

## Every funbox

| Name | Rule / host ownership | Evidence |
| --- | --- | --- |
| `58008` | Rust rules; retain any visual/input hooks in host | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `mirror` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `upside_down` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `nausea` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `round_round_baby` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `simon_says` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `tts` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `choo_choo` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `arrows` | Rust rules; retain any visual/input hooks in host | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `rAnDoMcAsE` | Rust rules; retain any visual/input hooks in host | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `sPoNgEcAsE` | Rust rules; retain any visual/input hooks in host | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `capitals` | Rust rules; retain any visual/input hooks in host | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `layout_mirror` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `layoutfluid` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `earthquake` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `space_balls` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `gibberish` | Rust rules; retain any visual/input hooks in host | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `ascii` | Rust rules; retain any visual/input hooks in host | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `specials` | Rust rules; retain any visual/input hooks in host | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `plus_zero` | Rust generation lookahead; host visibility/layout | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `plus_one` | Rust generation lookahead; host visibility/layout | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `plus_two` | Rust generation lookahead; host visibility/layout | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `plus_three` | Rust generation lookahead; host visibility/layout | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `read_ahead_easy` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `read_ahead` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `read_ahead_hard` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `memory` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `nospace` | Rust rules; retain any visual/input hooks in host | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `poetry` | Rust rules; retain any visual/input hooks in host | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `wikipedia` | Rust rules; retain any visual/input hooks in host | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `weakspot` | Rust rules; retain any visual/input hooks in host | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `pseudolang` | Rust rules; retain any visual/input hooks in host | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `IPv4` | Rust rules; retain any visual/input hooks in host | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `IPv6` | Rust rules; retain any visual/input hooks in host | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `binary` | Rust rules; retain any visual/input hooks in host | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `hexadecimal` | Rust rules; retain any visual/input hooks in host | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `zipf` | Rust rules; retain any visual/input hooks in host | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `morse` | Rust rules; retain any visual/input hooks in host | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `crt` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `backwards` | Rust rules; retain any visual/input hooks in host | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `ddoouubblleedd` | Rust rules; retain any visual/input hooks in host | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `instant_messaging` | Rust rules; retain any visual/input hooks in host | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `underscore_spaces` | Rust rules; retain any visual/input hooks in host | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `ALL_CAPS` | Rust rules; retain any visual/input hooks in host | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `polyglot` | Rust rules; retain any visual/input hooks in host | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `asl` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `rot13` | Rust rules; retain any visual/input hooks in host | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |
| `no_quit` | Rust rules; retain any visual/input hooks in host | Native/Wasm metadata + forced/compatibility policies pass; rule transforms in generation oracle; host hooks Stage 2 |

## Website generation/support gate (Phase 2.3)

All modes and rule-bearing funboxes now use native BrowserContent/BrowserSession.
The frontend registry retains visual/audio/platform hooks only. Native policies
serve settings compatibility/forced configuration and restart eligibility. Practice,
learning and pace decisions use native queries. Quote modal/catalog shares native
queue storage and selected-object normalization with test generation. All 61
original generator snapshots pass through the actual browser binding/asset adapter.
Built-site source tests cover delayed batches, cancellation, source failure and
retained original event timing; settings imports/commands/quotes/restarts pass the
broader existing browser suite. Results/replay consumers remain Phase 2.4 work.
