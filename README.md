# Oxytype

Oxytype is an independent, open-source typing test. It offers multiple test modes, languages, themes, live speed and accuracy feedback, and account-based result history.

This project began from the Monkeytype codebase and now has its own roadmap. We retain the original contributors' work and attribution in the Git history. Oxytype is licensed under [GPL-3.0](./LICENSE).

Oxytype does not support self-hosting. For self-hosting, use [Monkeytype](https://github.com/monkeytypegame/monkeytype).

## Terminal client

The Bun/OpenTUI terminal client shares your account with the website and supports
offline typing. After its first npm release:

```sh
bunx @voltcrash/oxytype
bunx @voltcrash/oxytype --words 25
bunx @voltcrash/oxytype login
```

Requires Bun 1.3.0+ and an 80×20 terminal. See [terminal setup and controls](./docs/TUI.md)
and the [feature audit](./tui/MISSING.md). Develop locally with `vp run dev-tui`.

## Development

Use Node 24.21.0 and [Vite+](https://viteplus.dev/guide/) (`vp`) for every command; pnpm 12.8.1 is the package manager under the hood. Follow [the development setup guide](./docs/CONTRIBUTING_ADVANCED.md) for Better Auth and backend configuration. See [the architecture overview](./docs/ARCHITECTURE.md) for the codebase and stack.

```sh
vp install
vp exec cp frontend/.dev.vars.example frontend/.dev.vars
vp run --filter @oxytype/frontend db:migrate
vp run dev
```

The TanStack Start app, its API and local D1 run at `http://localhost:3000`.

## Contributing

See [CONTRIBUTING.md](./docs/CONTRIBUTING.md) and the [code of conduct](./docs/CODE_OF_CONDUCT.md). Report bugs in the [Oxytype repository](https://github.com/voltcrash/oxytype/issues).

## Contact and security

Public site: [oxytype.voltcrash.com](https://oxytype.voltcrash.com). Maintainers use [production operations](./docs/PRODUCTION_SETUP.md) for the official site's deployment and updates.

Use [GitHub discussions](https://github.com/voltcrash/oxytype/discussions) for general questions and feature ideas, and [the security policy](./docs/SECURITY.md) for private vulnerability reports.
