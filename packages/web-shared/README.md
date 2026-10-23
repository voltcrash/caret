# Web shared helpers

SSR-safe settings migration, metadata, themes and preference sequencing. Shared
engine defaults come from generated Rust artifacts through `typing-engine/config`.
This package never imports the browser Wasm initializer. The website supplies
native funbox policy checks; labels, dependent UI preferences, storage and browser
shortcuts remain host responsibilities.

Legacy typing-core re-exports are temporary oracle dependencies and are retired
with that engine in migration Phase 2.6.
