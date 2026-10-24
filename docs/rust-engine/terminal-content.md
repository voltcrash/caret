# Offline terminal content

The binary embeds the existing 200-word English asset and eight original Oxytype
practice passages. Both are GPL-3.0-only; attribution and the English source hash
are in `crates/oxytype-tui/assets/ATTRIBUTION.md`. Nothing downloads at startup.

`oxytype --mode words --words 25 --seed 42` uses the shared native generator.
Other modes: `time`, `quote`, `custom`, `zen`. Defaults come from core Config.
`--punctuation`, `--numbers`, `--difficulty`, `--stop-on-error`,
`--delete-on-error`, `--confidence`, `--freedom`, `--strict-space` project into
that same Config. `--capabilities` lists the explicit terminal funbox subset;
other hooks fail rather than silently substituting content. Incompatible forced
settings are rejected using native metadata.

Custom text: `--text 'one two three'` or `--file practice.txt` (UTF-8, ≤8 MiB).
This implies custom mode unless another mode is explicitly supplied (an error).
`--custom-order repeat|random|shuffle`, `--custom-limit word|time|section`, and
`--custom-length N` feed the core's custom content contract. Default order is repeat;
default word limit covers all supplied words. An omitted time length uses core's
default time. Explicit zero retains native infinite behavior. Zero means infinite
where defined by core. Literal spaces separate supplied entries. CRLF/CR decode as LF; LF terminates
an entry so Enter commits it. The core's space equivalents (including NBSP and a UTF-8 BOM) become entry
separators. Tab and other Unicode text retain their literal UTF-16 units.
No NFC rewrite is imposed by the terminal adapter. Native rules retain all normalization and scoring responsibility.

Extend offline content with `--pack pack.json`. Version 1:

```json
{
  "formatVersion": 1,
  "license": "CC0-1.0",
  "attribution": "Your content author",
  "language": {
    "name": "example",
    "bcp47": "en",
    "words": ["alpha", "beta", "gamma"]
  },
  "quotes": [{"id": 1, "text": "An original practice passage.", "source": "Your author"}]
}
```

The file must be valid UTF-8 JSON, ≤8 MiB. License/attribution required; unique
quote IDs and nonempty words/text. Language names: ASCII alphanumeric/underscore,
≤128 bytes. Optional language fields: `rightToLeft`, `joiningScript`,
`originalPunctuation`, `noLazyMode`, `additionalAccents` (pairs of strings).
Language metadata passes shared engine bounds; terminal control sequences and
direction overrides are rejected. Only Tab/LF control characters are accepted.
Terminal shaping limitations still apply; a pack cannot grant keyboard/display
capabilities. No fetching or silent fallback to English for a missing language.

Quote lengths count UTF-16 units: group 0 = 0–124, 1 = 125–249, 2 = 250–499,
3 = 500–1,000,000. `--quote-length 0,1,2,3` selects groups; default group 1 is the
native default. Missing selected groups fail clearly. Packs need not contain
quotes when used for word/time tests. Quotes are selected/normalized by core.
