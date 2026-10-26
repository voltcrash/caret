# Adding quotes

Follow [basic contributions](CONTRIBUTING_BASIC.md) to fork and open a pull request.

Add entries to the `quotes` array in `frontend/static/quotes/<language>.json`.
The language must exist in `LanguageSchema` in `packages/schemas/src/languages.ts`.
Each quote needs:

- `text`: the quote text, at least 60 characters.
- `source`: its attribution.
- `id`: the next unused numeric ID in that language file.
- `length`: the text's JavaScript string length, including spaces and punctuation.

For a new quote language file, copy an existing file's structure: `language`,
`groups` and `quotes`. Set `language` to match the filename without `.json`.
Keep four contiguous length groups; the usual ranges are `[0, 100]`, `[101, 300]`,
`[301, 600]` and `[601, 9999]`.

Check [quote guidelines](CONTRIBUTING.md#quote-guidelines) and include translations
of non-English quotes in the pull request description.
For local validation, follow [development setup](CONTRIBUTING_ADVANCED.md), then
run from the repository root:

```sh
vp run --filter @caret/frontend check-assets quotes json
```
