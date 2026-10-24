# Native release procedure

No terminal release has been published by this migration. Candidate archives and
their build/smoke evidence must pass review before a maintainer creates a release
tag. Website production authorization/workflow remains separate.

`terminal-release.yml` builds/test/smokes five native candidates on PRs touching
native/core/build inputs. It does not run for unrelated website edits. Each job
uses pinned Rust 1.99.1, the lockfile, vp tasks and a native runner. Core fixtures,
Clippy and terminal tests run before release compilation. POSIX jobs also test
debug lifecycle and extracted release binaries in a real PTY. Windows runs native
tests including actual ConPTY typing/editing/history and headless archive smoke;
Windows Terminal manual input remains separate.

| Candidate target | Runner / conservative requirements | Build/smoke status |
| --- | --- | --- |
| x86_64-unknown-linux-gnu | Ubuntu 24.04; GNU libc 2.39 baseline; not static musl | Pass |
| aarch64-unknown-linux-gnu | Ubuntu 24.04 ARM; GNU libc 2.39 baseline; not static musl | Pass |
| x86_64-apple-darwin | macOS 15 Intel; deployment target explicitly 15.0 | Pass |
| aarch64-apple-darwin | macOS 15 Apple Silicon; deployment target explicitly 15.0 | Pass |
| x86_64-pc-windows-msvc | Windows Server 2025 native runner; static CRT | Pass; Windows Terminal manual pending |

All five candidates and corresponding source passed in [run 40068412137](https://github.com/voltcrash/oxytype/actions/runs/40068412137)
for source head `5703c1f10bd949478d3801d027965ac2214f3738`.
[terminal-artifacts.json](terminal-artifacts.json) records downloaded archive sizes
and SHA-256 hashes. All six individual checksums and binary/source revision pairing
were verified with the publishing checksum collector. PR jobs check out GitHub's
merge revision: all binary SOURCE.md files and source SOURCE_REVISION identify
`b62151798e1c1f469d13501a1cf9479a83bdca0b`. These are temporary CI candidates
(14-day retention), not published releases. Documentation-only commits do not
retroactively change this immutable evidence.

Do not claim lower OS/libc versions or untested terminals supported. Runner labels
were checked against [GitHub's runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).
Current manual coverage lives in terminal.md and terminal-verification.json.
Only real emulator records can change those pending entries to pass.
The implementation workspace is Linux only; the user confirmed no other test
machine is available. Real Linux enhanced, macOS emulator and Windows Terminal
font/IME/input checks remain unperformed. Publication remains gated.

Build locally: `vp run terminal:package -- --target TARGET`; use the matching native
toolchain/runner. Archives go under `target/terminal-release/` with individual
`.sha256` files. `vp run terminal:archive-smoke -- --archive PATH` verifies the hash,
extracts, and runs the executable with an empty PATH/working directory. It checks
version/help/diagnostics, explicitly synthetic bundled-mode smoke, local storage
and export; supported POSIX hosts additionally test actual interactive input.
No saved result is fabricated by the synthetic smoke path.

Each archive includes GPL LICENSE, bundled content attribution, third-party
notices/license text, install/data docs and exact source revision. Notices cover
the complete locked workspace dependency set (a conservative superset). The two
ts-rs packages omit their upstream LICENSE from crates.io packages: the exact
upstream revision/license/hash is pinned under third-party and mechanically
checked against cargo VCS metadata. Missing notices stop packaging.

`vp run terminal:source` archives committed source, vendors locked dependencies,
adds SOURCE_REVISION, and proves `cargo check --offline --locked` from that tree
with a separate target directory. The resulting corresponding-source archive is
published beside binaries. Its `.cargo/config.toml` uses a relative vendor path.
Source builds use the pinned toolchain; set OXYTYPE_BUILD_REV from SOURCE_REVISION
to retain provenance. No source registry access is needed once tools are installed.

After all five native jobs, source build and the real terminal matrix pass, review
the PR and final source commit. Follow maintainer authorization, update the Cargo
workspace version/release notes, then push the matching `terminal-vVERSION` tag.
Tag mismatch fails. The tag rebuilds all artifacts, and publication additionally
requires `vp run terminal:release-gate` to accept recorded manual evidence.
Publication alone gets contents:write; PR/build jobs have contents:read, checkout
credentials are not persisted. No account or deployment secrets are used.

The publishing job verifies all six platform/source checksums and produces
SHA256SUMS before creating the GitHub Release. Development PRs and manual workflow
runs upload temporary CI candidates only. They do not publish releases or deploy
the website. Never bypass the manual gate by marking unperformed checks passed.
