# Migration decisions

- Sole implementation owner; three stacked stage PRs, as requested.
- Text boundary uses UTF-16 unit arrays. Rust String cannot preserve an isolated
  surrogate; unit arrays avoid a lossy JSON string roundtrip and work natively.
- Keep original fixtures during Stage 1; neutral reference package holds exact
  copies, checked by SHA-256. Removal of old package waits for Stage 2 gate.
- Record web/headless differences in contract. Headless session is an oracle for
  matching cases, not permission to change browser behavior.
- Use installed Rust 1.99.1 as candidate pin. Confirm target/tool compatibility
  before finalizing Phase 1.3; no lower MSRV support claimed without a build.
- Offline terminal initial scope excludes accounts/sync. Publication follows
  repository release authorization; no production deployment implied by this task.
