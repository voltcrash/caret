# Feature parity checklist

Every entry must pass before Stage 1 / web cutover. Pending means its complete acceptance gate remains open; partial native/browser evidence is tracked in progress.md.

| Feature | Rust | Native / Wasm / web evidence |
| --- | --- | --- |
| words: finite / zero infinite | Pending | Existing fixtures + targeted gaps required |
| time: presets / custom / zero infinite | Pending | Existing fixtures + targeted gaps required |
| quote: lengths / IDs / repeat / British text | Pending | Existing fixtures + targeted gaps required |
| custom: random / repeat / shuffle; pipe sections; word / time / section limits | Pending | Existing fixtures + targeted gaps required |
| zen: free typing / bailout / trailing idle | Pending | Existing fixtures + targeted gaps required |
| language: lazy accents / additional accents / noLazyMode | Pending | Existing fixtures + targeted gaps required |
| punctuation / original punctuation / numbers / numeral scripts | Pending | Existing fixtures + targeted gaps required |
| wordset: random / Zipf / shuffled / previous-two exclusion | Pending | Existing fixtures + targeted gaps required |
| funbox sections / polyglot language properties / asynchronous content | Pending | Existing fixtures + targeted gaps required |
| normal / expert / master difficulty | Pending | Existing fixtures + targeted gaps required |
| strictSpace / stopOnError letter and word | Pending | Existing fixtures + targeted gaps required |
| deleteOnError letter / word / hard; stopped-input interaction | Pending | Existing fixtures + targeted gaps required |
| confidence off / on / max; freedomMode; visible-word bound | Pending | Existing fixtures + targeted gaps required |
| UTF-16 split commits / partial surrogates / grapheme-independent scores | Pending | Existing fixtures + targeted gaps required |
| IME multi-character / composition quick finish / equivalent spaces | Pending | Existing fixtures + targeted gaps required |
| typography equivalents / ellipsis / Dutch ligature / opposite Shift | Pending | Existing fixtures + targeted gaps required |
| code automatic tabs / unindent / newline / Firefox deletion | Pending | Existing fixtures + targeted gaps required |
| timer drift / catchup / background stalls / simultaneous timestamps | Pending | Existing fixtures + targeted gaps required |
| reset / restart / repeat / abandon / completion once / stale commands | Pending | Existing fixtures + targeted gaps required |
| minimum burst / speed / accuracy; flex burst | Pending | Existing fixtures + targeted gaps required |
| pace correction / remembered speed / weak-spot learning | Pending | Existing fixtures + targeted gaps required |
| accuracy / WPM / raw / chars / consistency / burst | Pending | Existing fixtures + targeted gaps required |
| physical timing / synthetic observations / estimated release markers | Pending | Existing fixtures + targeted gaps required |
| histories / charts / idle / incomplete duration / validity | Pending | Existing fixtures + targeted gaps required |
| historical replay / seek / regression / clearedNextWord | Pending | Existing fixtures + targeted gaps required |
| CompletedEvent fields / schemas / submission hash / backend rejection | Pending | Existing fixtures + targeted gaps required |
| settings imports / presets / URL overrides / live rules | Pending | Existing fixtures + targeted gaps required |
| custom text progress / practice missed and slow words | Pending | Existing fixtures + targeted gaps required |
| SSR safety / Cloudflare asset MIME+CSP / stale tabs / rollback | Pending | Existing fixtures + targeted gaps required |

## Every funbox

| Name | Rule / host ownership | Evidence |
| --- | --- | --- |
| `58008` | Rust rules; retain any visual/input hooks in host | Pending |
| `mirror` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Pending |
| `upside_down` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Pending |
| `nausea` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Pending |
| `round_round_baby` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Pending |
| `simon_says` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Pending |
| `tts` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Pending |
| `choo_choo` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Pending |
| `arrows` | Rust rules; retain any visual/input hooks in host | Pending |
| `rAnDoMcAsE` | Rust rules; retain any visual/input hooks in host | Pending |
| `sPoNgEcAsE` | Rust rules; retain any visual/input hooks in host | Pending |
| `capitals` | Rust rules; retain any visual/input hooks in host | Pending |
| `layout_mirror` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Pending |
| `layoutfluid` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Pending |
| `earthquake` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Pending |
| `space_balls` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Pending |
| `gibberish` | Rust rules; retain any visual/input hooks in host | Pending |
| `ascii` | Rust rules; retain any visual/input hooks in host | Pending |
| `specials` | Rust rules; retain any visual/input hooks in host | Pending |
| `plus_zero` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Pending |
| `plus_one` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Pending |
| `plus_two` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Pending |
| `plus_three` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Pending |
| `read_ahead_easy` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Pending |
| `read_ahead` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Pending |
| `read_ahead_hard` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Pending |
| `memory` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Pending |
| `nospace` | Rust rules; retain any visual/input hooks in host | Pending |
| `poetry` | Rust rules; retain any visual/input hooks in host | Pending |
| `wikipedia` | Rust rules; retain any visual/input hooks in host | Pending |
| `weakspot` | Rust rules; retain any visual/input hooks in host | Pending |
| `pseudolang` | Rust rules; retain any visual/input hooks in host | Pending |
| `IPv4` | Rust rules; retain any visual/input hooks in host | Pending |
| `IPv6` | Rust rules; retain any visual/input hooks in host | Pending |
| `binary` | Rust rules; retain any visual/input hooks in host | Pending |
| `hexadecimal` | Rust rules; retain any visual/input hooks in host | Pending |
| `zipf` | Rust rules; retain any visual/input hooks in host | Pending |
| `morse` | Rust rules; retain any visual/input hooks in host | Pending |
| `crt` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Pending |
| `backwards` | Rust rules; retain any visual/input hooks in host | Pending |
| `ddoouubblleedd` | Rust rules; retain any visual/input hooks in host | Pending |
| `instant_messaging` | Rust rules; retain any visual/input hooks in host | Pending |
| `underscore_spaces` | Rust rules; retain any visual/input hooks in host | Pending |
| `ALL_CAPS` | Rust rules; retain any visual/input hooks in host | Pending |
| `polyglot` | Rust rules; retain any visual/input hooks in host | Pending |
| `asl` | Host visual/audio/layout; Rust retains metadata effects on eligibility/config | Pending |
| `rot13` | Rust rules; retain any visual/input hooks in host | Pending |
| `no_quit` | Rust rules; retain any visual/input hooks in host | Pending |
