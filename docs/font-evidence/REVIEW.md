# Sol review ledger

Budget: three sequential rounds; one reviewer, no nested agents.
Provider/model/effort verified through T3 capabilities: Codex,
`gpt-6.1-sol`, `reasoningEffort=xhigh`.

Scope: safe full-face font candidate plus manual tools, licensing and observed
proof. The original split/core-preload acceptance gate is explicitly blocked;
review does not waive it. Publication is a partial-candidate handoff to the parent, not permission to merge.

Diff command for every round:
`git diff 7699fef5239c2082baa1ef1b2be8014ff3d02714`.

| Round | State | Findings | Usage |
|---|---|---|---|
| 1 | CHANGES | S1 should: missing/after-only cases could falsely pass. Fixed: require nonempty matching PNG sets before comparison. Six CLI tests pass, four fail before fix; both real 62-case comparisons rerun. | Not returned |
| 2 | APPROVE, scoped recheck | S1 resolved; six CLI tests pass; both real 62-case comparisons independently verified; no new findings. Original acceptance remains blocked. | Not returned |

Round 1 input diff: 1,063 files / 70,542 insertions. After S1, Round 2 input:
1,064 files / 70,651 insertions. S1 added one focused manual regression-test
file plus the fail-closed guard and documentation. No font bytes changed in the
review loop. No findings declined; no review blocker/should remains open for
the reviewed partial candidate. Usage was not exposed in either round.

At review time the original strict split/core-preload acceptance gate remained
blocked. On 2026-10-31 the user accepted the safe full-face reduction and
authorized merge after CI. This scope decision does not approve any rendering
change or claim successful splitting. Parent owns CI monitoring and merge;
no child watch or merge was performed.
