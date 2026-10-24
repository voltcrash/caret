# Oxytype

Oxytype is an independent, open-source typing test. It offers multiple test modes, languages, themes, live speed and accuracy feedback, and account-based result history.

This project began from the Monkeytype codebase and now has its own roadmap. We retain the original contributors' work and attribution in the Git history. Oxytype is licensed under [GPL-3.0](./LICENSE).

Oxytype does not support self-hosting. For self-hosting, use [Monkeytype](https://github.com/monkeytypegame/monkeytype).

## Development

Use Node 24.21.0 and [Vite+](https://viteplus.dev/guide/) (`vp`) for every command; pnpm 12.8.1 is the package manager under the hood. Follow [the development setup guide](./docs/CONTRIBUTING_ADVANCED.md) for Better Auth and backend configuration. See [the architecture overview](./docs/ARCHITECTURE.md) for the codebase and stack.

```sh
vp install
vp exec cp frontend/.dev.vars.example frontend/.dev.vars
vp run --filter @oxytype/frontend db:migrate
vp run dev
```

The TanStack Start app, its API and local D1 run at `http://localhost:3000`.

Typing rules run in the platform-independent [Rust engine](./crates/typing-engine).
The website loads its [Wasm SDK](./packages/typing-engine/README.md) only in the
browser; Cloudflare continues serving SSR, auth and APIs. Install the toolchain
pinned in `rust-toolchain.toml` with its Wasm target. Build bootstrap generates the
bindings automatically; `vp run engine:parity` checks native and built-browser
behavior against immutable original references. `vp run engine:lint` and
`vp run engine:fmt` check Rust. Reference provenance and measured budgets are in
[migration progress](./docs/rust-engine/progress.md).

## Contributing

See [CONTRIBUTING.md](./docs/CONTRIBUTING.md) and the [code of conduct](./docs/CODE_OF_CONDUCT.md). Report bugs in the [Oxytype repository](https://github.com/voltcrash/oxytype/issues).

## Contact and security

Public site: [oxytype.voltcrash.com](https://oxytype.voltcrash.com). Maintainers use [production operations](./docs/PRODUCTION_SETUP.md) for the official site's deployment and updates.

Use [GitHub discussions](https://github.com/voltcrash/oxytype/discussions) for general questions and feature ideas, and [the security policy](./docs/SECURITY.md) for private vulnerability reports.
