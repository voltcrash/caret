# Native release procedure

No terminal release has been published by this migration. Candidate archives and
their build/smoke evidence must pass review before a maintainer creates a release
tag. Website production authorization/workflow remains separate.

`terminal-release.yml` runs when native/core/build inputs change. It does not run
for unrelated website edits. Pull requests run one Linux x64 job; main pushes,
tags and manual runs build/test/smoke all four native candidates plus
corresponding source. Each job uses pinned Rust 1.99.1, the lockfile, vp tasks
and a native runner. Core fixtures, Clippy and terminal tests run before release
compilation. Every native job also tests the debug lifecycle in a real PTY, and
outside pull requests the extracted release binary too. The Linux x64 job also
exercises Kitty and Alacritty through actual XTest events in private Xvfb
displays, retaining exact versions and input/output/cleanup evidence.

| Candidate target | Runner / conservative requirements | Build/smoke status |
| --- | --- | --- |
| x86_64-unknown-linux-gnu | Ubuntu 24.04; GNU libc 2.39 baseline; not static musl | Pass |
| aarch64-unknown-linux-gnu | Ubuntu 24.04 ARM; GNU libc 2.39 baseline; not static musl | Pass |
| x86_64-apple-darwin | macOS 15 Intel; deployment target explicitly 15.0 | Pass |
| aarch64-apple-darwin | macOS 15 Apple Silicon; deployment target explicitly 15.0 | Pass |

All four native candidates, both real Linux emulator jobs and corresponding
source passed [run 40085257392](https://github.com/voltcrash/caret/actions/runs/40085257392)
for source head `6f6b25f7f4c2dc63958b3c3ccfa84d47676a4f1f`.
[terminal-artifacts.json](terminal-artifacts.json) records exact downloaded sizes
and SHA-256 hashes. All five checksums and binary/source revision pairs were
verified with the publisher's checksum collector. All SOURCE.md/SOURCE_REVISION
files identify GitHub's tested PR merge revision
`1258809f217c112e5566f33e803b9a19d6b6aefb`.
These are temporary CI candidates (14-day retention), not published releases.
Subsequent evidence-only commits do not retroactively change this record.

The owner narrowed support to Linux/macOS after #184/#185 merged; Windows is out
of scope. [Earlier five-target evidence](archive/terminal-artifacts-40068412137.json)
is archived unchanged for provenance and is not the supported target list.

Do not claim lower OS/libc versions or untested terminals supported. Runner labels
were checked against [GitHub's runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).
The Linux x64 job (with both emulators) governs merge readiness; the full
matrix on main and tags catches macOS/ARM and archive regressions before release.
The owner will perform [macOS manual verification](terminal-macos-check.md) after
merge; that remains the sole manual publication record in terminal-verification.json.
Linux automated emulator checks replace the former external-contributor requirement.
Unperformed physical IME/font checks remain explicit. This does not block PR
review/merge under the owner's revised scope; publication remains a separate gate.

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
Source builds use the pinned toolchain; set CARET_BUILD_REV from SOURCE_REVISION
to retain provenance. No source registry access is needed once tools are installed.

After all four native jobs, emulator jobs, source build and the release matrix pass, review
the PR and final source commit. Follow maintainer authorization, update the Cargo
workspace version/release notes, then push the matching `terminal-vVERSION` tag.
Tag mismatch fails. The tag rebuilds all artifacts, and publication additionally
requires `vp run terminal:release-gate` to accept recorded manual evidence.
Publication alone gets contents:write; PR/build jobs have contents:read, checkout
credentials are not persisted. No account or deployment secrets are used.

The publishing job verifies all five platform/source checksums and produces
SHA256SUMS before creating the GitHub Release. Development PRs and manual workflow
runs upload temporary CI candidates only. They do not publish releases or deploy
the website. Never bypass the manual gate by marking unperformed checks passed.
