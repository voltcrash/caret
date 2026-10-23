# Web shared helpers

SSR-safe settings migration, metadata, themes and preference sequencing. Shared
engine defaults come from generated Rust artifacts through `typing-engine/config`.
This package never imports the browser Wasm initializer. The website supplies
native funbox policy checks; labels, dependent UI preferences, storage and browser
shortcuts remain host responsibilities.

Also owns browser event wire types, physical layout translation, content loading,
command matching, result hashing and display formatting. `live-stats` formats
native metrics and maps native cursor/config values to progress labels; it never
advances a session, ends a timer, generates targets or computes typing scores.
Typography cleanup is an explicit custom-text editor action, not typing input
normalization. Account daily totals remain storage/display helpers.
