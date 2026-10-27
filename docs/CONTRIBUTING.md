# Contributing

Caret uses TypeScript, TanStack Start with SolidJS, Tailwind CSS and backend
services on one Cloudflare Worker with Neon PostgreSQL and Cron. See [architecture](ARCHITECTURE.md).

For asset or documentation edits, follow [basic contributions](CONTRIBUTING_BASIC.md).
For application changes, follow [development setup](CONTRIBUTING_ADVANCED.md).
Open pull requests against `main`.

## Pull request titles

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for
pull request titles and commit messages. Use types `build`, `chore`,
`ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style` and `test`.
Scopes are optional. Examples:

- `feat(quotes): add French quotes`
- `fix(leaderboard): show user rank correctly`
- `docs: update development setup`

## Theme guidelines

- Choose a unique theme with readable text and good contrast.
- Use near-black or near-white text.
- Register it in the theme schema and constants.
- Check with flip test colors and colorful mode both enabled and disabled.
- Include screenshots with those settings in the pull request.

See [adding themes](THEMES.md).

## Language guidelines

- Exclude expletives and duplicate words.
- Use valid JSON with no trailing commas.
- Register each word list in the language schema and exactly one language group.
- Match the word count to the filename: the base list has 200 words, `_1k` has
  1,000, and so on.

See [adding languages](LANGUAGES.md).

## Quote guidelines

- Exclude unlawful, abusive or obscene content.
- Use valid JSON and check for duplicate text and IDs.
- Set `length` to the text's JavaScript string length and use the next unused ID.
- Add quotes of at least 60 characters.
- Include translations of non-English quotes in the pull request description.

See [adding quotes](QUOTES.md).

## Layout guidelines

Match the layout schema's key counts and character order. See
[adding layouts](LAYOUTS.md).

## Font guidelines

Use WOFF2 files, valid font names and matching schema/constants entries. See
[adding fonts](FONTS.md).

## Questions

Open an [issue](https://github.com/voltcrash/caret/issues) for bugs or a
[discussion](https://github.com/voltcrash/caret/discussions) for questions and ideas.
