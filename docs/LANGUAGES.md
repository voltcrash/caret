# Adding languages

Follow [basic contributions](CONTRIBUTING_BASIC.md) to fork and open a pull request.

1. Add `frontend/static/languages/<name>.json`, copying a similar existing list.
   Use the base language name for 200 words and suffixes such as `_1k` for larger
   lists. The JSON `name` must match the filename without `.json`.
2. Add every list name to `LanguageSchema` in `packages/schemas/src/languages.ts`.
3. Add every list to exactly one group in `LanguageGroups` in
   `frontend/src/ts/constants/languages.ts`.

The JSON requires `name` and `words`. Optional rendering fields include:

- `rightToLeft`: text runs right to left.
- `joiningScript`: letters join or change shape with their neighbours.
- `orderedByFrequency`: words are ordered from most to least common.
- `bcp47`: the language's IETF language tag.
- `preferredFont`: a registered font; see [adding fonts](FONTS.md).

See `LanguageObjectSchema` in `packages/schemas/src/languages.ts` for all supported
fields and [language guidelines](CONTRIBUTING.md#language-guidelines) for content.
For local validation, follow [development setup](CONTRIBUTING_ADVANCED.md), then
run from the repository root:

```sh
vp run --filter @caret/frontend check-assets languages json
```
